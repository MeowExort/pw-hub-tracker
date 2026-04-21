import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createHash, randomBytes } from 'crypto'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'

/**
 * Простой парсер `.env` без зависимости от dotenv.
 */
function loadDotEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const content = readFileSync(path.resolve(__dirname, '.env'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  } catch {
    // .env отсутствует — не критично
  }
  return env
}
const dotEnv = loadDotEnv()

/**
 * Список API-действий трекера — должен совпадать с `server/index.js`.
 * Каждая запись: `[name, method, pathTemplate, isSearch?]`.
 * В клиентский бандл попадает только `[method, pathTemplate, actionHash, isSearch]`,
 * без имён действий.
 */
/**
 * Признак "рыночного" действия. Rate limiting и CAPTCHA применяются только
 * к `market: true` — это страницы Рынка (pshop/магазины/предметы/дэшборд,
 * боты и т.п.). Для остальных действий (players/teams/matches/analytics)
 * ограничения по частоте и CAPTCHA не применяются.
 *
 * PoW и HMAC-подпись продолжают действовать для всех запросов — это общая
 * защита API от прямого парсинга в обход клиента.
 */
type RawAction = [string, string, string, boolean?, boolean?] // [name, method, path, isSearch, isMarket]
const ACTIONS: RawAction[] = [
  // --- Рынок (pshop / shops) — защищаем rate-limit + CAPTCHA ---
  ['getMarketSummary', 'GET', '/api/pshop/market-summary', false, true],
  ['getItems', 'GET', '/api/pshop/items', true, true],
  ['getPopularItems', 'GET', '/api/pshop/items/popular', false, true],
  ['getPriceHistory', 'GET', '/api/pshop/items/:itemId/price-history', false, true],
  ['getItemSpread', 'GET', '/api/pshop/items/:itemId/spread', false, true],
  ['getTradesSummary', 'GET', '/api/pshop/trades/summary', false, true],
  ['getTradesByItem', 'GET', '/api/pshop/trades/by-item', false, true],
  ['getPlayerShop', 'GET', '/api/pshop/players/:server/:playerId/shop', false, true],
  ['getShops', 'GET', '/api/shops/:server', true, true],
  ['getShopsItemsAutocomplete', 'GET', '/api/shops/:server/items-autocomplete', true, true],
  ['getBots', 'GET', '/api/pshop/bots', false, true],
  ['getBotScore', 'GET', '/api/pshop/players/:server/:playerId/bot-score', false, true],
  // v2-агрегаты (B1/B2/B3/B5)
  ['getShopProfile', 'GET', '/api/pshop/v2/players/:server/:playerId/shop-profile', false, true],
  ['getItemDetails', 'GET', '/api/pshop/v2/items/:itemId/details', false, true],
  ['getItemsBatch', 'POST', '/api/pshop/v2/items/batch', false, true],
  ['getMarketDashboard', 'GET', '/api/pshop/v2/market/dashboard', false, true],
  ['getTradesOverview', 'GET', '/api/pshop/v2/trades/overview', false, true],
  // players
  ['getPlayers', 'GET', '/api/players', true],
  ['getPlayerById', 'GET', '/api/arena/players/:server/:playerId'],
  ['getPlayerMatches', 'GET', '/api/arena/players/:server/:playerId/matches'],
  ['getPlayerScoreHistory', 'GET', '/api/arena/players/:server/:playerId/score-history'],
  ['getPlayerPropertiesMax', 'GET', '/api/players/properties/max'],
  ['getPlayerPropertiesByIds', 'POST', '/api/players/properties/by-ids'],
  // teams
  ['getTeams', 'GET', '/api/arena/teams'],
  ['searchTeams', 'GET', '/api/arena/teams/search', true],
  ['getTeamById', 'GET', '/api/arena/teams/:teamId'],
  ['getTeamMembers', 'GET', '/api/arena/teams/:teamId/members'],
  ['getTeamMatches', 'GET', '/api/arena/teams/:teamId/matches'],
  ['getTeamScoreHistory', 'GET', '/api/arena/teams/:teamId/score-history'],
  ['getTeamH2H', 'GET', '/api/arena/teams/:teamId/h2h/:opponentTeamId'],
  // matches
  ['getMatches', 'GET', '/api/arena/matches'],
  ['getMatchById', 'GET', '/api/arena/matches/:matchId'],
  // analytics — classes
  ['getClassDistribution', 'GET', '/api/analytics/classes/distribution'],
  ['getClassWinrate', 'GET', '/api/analytics/classes/winrate'],
  ['getClassAverageScore', 'GET', '/api/analytics/classes/average-score'],
  ['getPopularCompositions', 'GET', '/api/analytics/classes/popular-compositions'],
  ['getBestCompositions', 'GET', '/api/analytics/classes/best-compositions'],
  // analytics — players
  ['getPlayerCard', 'GET', '/api/analytics/players/:server/:playerId/card'],
  ['comparePlayers', 'GET', '/api/analytics/players/compare'],
  ['getPropertyHistory', 'GET', '/api/analytics/players/:server/:playerId/property-history'],
  ['getStatsDistribution', 'GET', '/api/analytics/players/stats-distribution'],
  ['getWinrateCorrelation', 'GET', '/api/analytics/players/winrate-correlation'],
  // analytics — time
  ['getMatchesPerDay', 'GET', '/api/analytics/time/matches-per-day'],
  ['getMatchesPerHour', 'GET', '/api/analytics/time/matches-per-hour'],
  ['getMatchesByDayOfWeek', 'GET', '/api/analytics/time/matches-by-day-of-week'],
  ['getHeatmap', 'GET', '/api/analytics/time/heatmap'],
  ['getTrends', 'GET', '/api/analytics/time/trends'],
  // analytics — servers
  ['getServersOverview', 'GET', '/api/analytics/servers/overview'],
  ['getServersAverageScore', 'GET', '/api/analytics/servers/average-score'],
  ['getServersPlayerStats', 'GET', '/api/analytics/servers/player-stats-comparison'],
  ['getServerSummary', 'GET', '/api/analytics/servers/:server/summary'],
]

/** Хеш действия — md5(`${name}:${salt}`).base64url.slice(0,8). Должен совпадать с BFF. */
function hashAction(name: string, salt: string): string {
  return createHash('md5').update(`${name}:${salt}`).digest('base64url').slice(0, 8)
}

/**
 * Значения BUILD_SALT и SIGNING_SECRET:
 * - в CI читаются из переменных окружения (ради воспроизводимости сборок),
 * - локально при отсутствии — генерируются случайно.
 */
const buildSalt = dotEnv.BUILD_SALT || process.env.BUILD_SALT || randomBytes(8).toString('hex')
const signingSecret = dotEnv.SIGNING_SECRET || process.env.SIGNING_SECRET || randomBytes(32).toString('hex')
// Обратная совместимость с остальным кодом конфига
const BUILD_SALT = buildSalt
const SIGNING_SECRET = signingSecret

/**
 * Массив маршрутов для клиентского бандла — имена действий намеренно не
 * включены: используются только хеши.
 */
const CLIENT_ROUTES: Array<[string, string, string, boolean, boolean]> = ACTIONS.map(
  ([name, method, routePath, isSearch, isMarket]) => [
    method,
    routePath,
    hashAction(name, BUILD_SALT),
    !!isSearch,
    !!isMarket,
  ],
)

/**
 * Плагин: выводит BUILD_SALT/SIGNING_SECRET в консоль и сохраняет их в
 * `dist/.build-env` для BFF-сервера.
 */
function buildInfoPlugin(): Plugin {
  return {
    name: 'pw-tracker-build-info',
    buildStart() {
      console.log(`\n[Build Info] BUILD_SALT=${buildSalt}`)
      console.log(`[Build Info] SIGNING_SECRET=${signingSecret}\n`)
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      mkdirSync(outDir, { recursive: true })
      const content = `BUILD_SALT=${buildSalt}\nSIGNING_SECRET=${signingSecret}\n`
      writeFileSync(path.join(outDir, '.build-env'), content, { mode: 0o600 })
      console.log(`[Build Info] Сохранено в dist/.build-env`)
    },
  }
}

/**
 * Плагин: в dev-режиме (`pnpm dev`) поднимает BFF-сервер `server/index.js`
 * как дочерний процесс, пробрасывая BUILD_SALT/SIGNING_SECRET и прочие env.
 * Вся конфигурация BFF попадает через environment, чтобы фронт и BFF имели
 * одинаковые ключи подписи.
 */
function bffRunnerPlugin(): Plugin {
  let child: ChildProcess | null = null
  const bffPort = dotEnv.PORT || process.env.BFF_PORT || process.env.PORT || '3000'

  const spawnBff = () => {
    const env = {
      ...process.env,
      ...dotEnv,
      BUILD_SALT: buildSalt,
      SIGNING_SECRET: signingSecret,
      PORT: bffPort,
    }
    console.log(`[BFF] Запуск server/index.js на порту ${bffPort}...`)
    const cp = spawn(process.execPath, ['server/index.js'], {
      cwd: __dirname,
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    cp.on('exit', (code, signal) => {
      if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
        console.log(`[BFF] Процесс завершился (code=${code}, signal=${signal})`)
      }
      child = null
    })
    return cp
  }

  return {
    name: 'pw-tracker-bff-runner',
    apply: 'serve',
    configureServer() {
      if (!child) child = spawnBff()
      const shutdown = () => {
        if (child && !child.killed) {
          child.kill('SIGTERM')
          child = null
        }
      }
      process.on('exit', shutdown)
      process.on('SIGINT', () => { shutdown(); process.exit(0) })
      process.on('SIGTERM', () => { shutdown(); process.exit(0) })
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    buildInfoPlugin(),
    ...(command === 'serve' ? [bffRunnerPlugin()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __SIGNING_SECRET__: JSON.stringify(SIGNING_SECRET),
    __BUILD_SALT__: JSON.stringify(BUILD_SALT),
    __ACTION_MAP__: JSON.stringify(CLIENT_ROUTES),
  },
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      // В dev-режиме проксируем BFF-эндпоинты на локальный server/index.js
      '/api/proxy': {
        target: process.env.VITE_BFF_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/pow-challenge': {
        target: process.env.VITE_BFF_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/session': {
        target: process.env.VITE_BFF_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/push': {
        target: process.env.VITE_BFF_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/alerts': {
        target: process.env.VITE_BFF_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/share': {
        target: process.env.VITE_BFF_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}))
