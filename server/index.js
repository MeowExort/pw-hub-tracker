/**
 * BFF-сервер для PW Hub Tracker.
 *
 * Обязанности:
 *  • раздача статики из dist/;
 *  • единая точка проксирования API — POST /api/proxy с подписью (HMAC),
 *    PoW, fingerprint, rate-limit и CAPTCHA;
 *  • выдача PoW-challenge (GET /api/pow-challenge).
 *
 * Реальный адрес API и `X-Api-Key` не попадают в клиентский бандл.
 */

import express from 'express'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// --- Загрузка build-env (значения, вшитые при сборке фронтенда) ---

function loadBuildEnv() {
  const env = {}
  try {
    const content = readFileSync(path.resolve(__dirname, 'dist', '.build-env'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  } catch {
    // файла нет — используем env
  }
  return env
}

const buildEnv = loadBuildEnv()

// --- Конфигурация ---

const PORT = parseInt(process.env.PORT || '3000', 10)
const API_TARGET = process.env.API_TARGET || 'https://api.tracker.pw-hub.ru'
const API_KEY = process.env.API_KEY || process.env.VITE_API_KEY || ''
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || ''
const SITE_URL = process.env.SITE_URL || 'https://tracker.pw-hub.ru'

const buildSalt = process.env.BUILD_SALT || buildEnv.BUILD_SALT || ''
const signingSecret = process.env.SIGNING_SECRET || buildEnv.SIGNING_SECRET || ''

if (!buildSalt || !signingSecret) {
  console.warn('[BFF] ⚠ BUILD_SALT / SIGNING_SECRET не заданы — проверки подписи отключены')
}

// --- Хеш действия (должен совпадать с vite.config.ts клиента) ---

function actionHash(name) {
  return createHash('md5').update(`${name}:${buildSalt}`).digest('base64url').slice(0, 8)
}

// --- Карта действий: hash → { method, path, search? } ---

const RAW_ACTIONS = [
  // pshop
  ['getMarketSummary', 'GET', '/api/pshop/market-summary'],
  ['getItems', 'GET', '/api/pshop/items', true],
  ['getPopularItems', 'GET', '/api/pshop/items/popular'],
  ['getPriceHistory', 'GET', '/api/pshop/items/:itemId/price-history'],
  ['getItemSpread', 'GET', '/api/pshop/items/:itemId/spread'],
  ['getTradesSummary', 'GET', '/api/pshop/trades/summary'],
  ['getTradesByItem', 'GET', '/api/pshop/trades/by-item'],
  ['getPlayerShop', 'GET', '/api/pshop/players/:server/:playerId/shop'],
  ['getShops', 'GET', '/api/shops/:server', true],
  ['getShopsItemsAutocomplete', 'GET', '/api/shops/:server/items-autocomplete', true],
  ['getBots', 'GET', '/api/pshop/bots'],
  ['getBotScore', 'GET', '/api/pshop/players/:server/:playerId/bot-score'],
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

const ACTION_ROUTE_MAP = {}
for (const [name, method, routePath, isSearch] of RAW_ACTIONS) {
  ACTION_ROUTE_MAP[actionHash(name)] = { method, path: routePath, isSearch: !!isSearch, name }
}

// --- Rate Limiting ---

const RATE_LIMITS = {
  ipPerMinute: 60,
  fpPerMinute: 100,
  searchPerMinute: 20,
  burstPerSecond: 10,
  windowMs: 60_000,
  burstWindowMs: 1_000,
  slowdownThreshold: 0.8,
  maxSlowdownMs: 2_000,
}

class ServerRateLimiter {
  constructor() {
    this.ipBuckets = new Map()
    this.fpBuckets = new Map()
    this.searchBuckets = new Map()
    this.burstBuckets = new Map()
    setInterval(() => this.cleanup(), 30_000).unref?.()
  }

  check(ip, fp, isSearch) {
    const now = Date.now()

    const burst = this.count(this.bucket(this.burstBuckets, ip), now, RATE_LIMITS.burstWindowMs)
    if (burst >= RATE_LIMITS.burstPerSecond) {
      return { limited: true, retryAfterSec: 1, slowdownMs: 0, captchaRequired: false }
    }

    const ipCount = this.count(this.bucket(this.ipBuckets, ip), now, RATE_LIMITS.windowMs)
    if (ipCount >= RATE_LIMITS.ipPerMinute) {
      return {
        limited: true,
        retryAfterSec: this.retryAfter(this.bucket(this.ipBuckets, ip), now, RATE_LIMITS.windowMs),
        slowdownMs: 0,
        captchaRequired: false,
      }
    }

    if (fp) {
      const fpCount = this.count(this.bucket(this.fpBuckets, fp), now, RATE_LIMITS.windowMs)
      if (fpCount >= RATE_LIMITS.fpPerMinute) {
        return {
          limited: true,
          retryAfterSec: this.retryAfter(this.bucket(this.fpBuckets, fp), now, RATE_LIMITS.windowMs),
          slowdownMs: 0,
          captchaRequired: false,
        }
      }
    }

    if (isSearch) {
      const key = fp || ip
      const sc = this.count(this.bucket(this.searchBuckets, key), now, RATE_LIMITS.windowMs)
      if (sc >= RATE_LIMITS.searchPerMinute) {
        return {
          limited: true,
          retryAfterSec: this.retryAfter(this.bucket(this.searchBuckets, key), now, RATE_LIMITS.windowMs),
          slowdownMs: 0,
          captchaRequired: false,
        }
      }
      if (sc / RATE_LIMITS.searchPerMinute >= 0.9) {
        return { limited: false, retryAfterSec: 0, slowdownMs: 0, captchaRequired: true }
      }
    }

    let slowdownMs = 0
    let captchaRequired = false
    const ratio = ipCount / RATE_LIMITS.ipPerMinute
    if (ratio >= RATE_LIMITS.slowdownThreshold) {
      const over = (ratio - RATE_LIMITS.slowdownThreshold) / (1 - RATE_LIMITS.slowdownThreshold)
      slowdownMs = Math.round(over * RATE_LIMITS.maxSlowdownMs)
    }
    if (ratio >= 0.9) captchaRequired = true

    return { limited: false, retryAfterSec: 0, slowdownMs, captchaRequired }
  }

  record(ip, fp, isSearch) {
    const now = Date.now()
    this.bucket(this.burstBuckets, ip).timestamps.push(now)
    this.bucket(this.ipBuckets, ip).timestamps.push(now)
    if (fp) this.bucket(this.fpBuckets, fp).timestamps.push(now)
    if (isSearch) this.bucket(this.searchBuckets, fp || ip).timestamps.push(now)
  }

  bucket(map, key) {
    let b = map.get(key)
    if (!b) {
      b = { timestamps: [] }
      map.set(key, b)
    }
    return b
  }

  count(b, now, windowMs) {
    const cutoff = now - windowMs
    return b.timestamps.filter((t) => t > cutoff).length
  }

  retryAfter(b, now, windowMs) {
    const cutoff = now - windowMs
    const oldest = b.timestamps.find((t) => t > cutoff)
    if (!oldest) return 1
    return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
  }

  cleanup() {
    const now = Date.now()
    const clean = (map, windowMs) => {
      for (const [k, b] of map.entries()) {
        const cutoff = now - windowMs
        b.timestamps = b.timestamps.filter((t) => t > cutoff)
        if (b.timestamps.length === 0) map.delete(k)
      }
    }
    clean(this.ipBuckets, RATE_LIMITS.windowMs)
    clean(this.fpBuckets, RATE_LIMITS.windowMs)
    clean(this.searchBuckets, RATE_LIMITS.windowMs)
    clean(this.burstBuckets, RATE_LIMITS.burstWindowMs)
  }
}

// --- Proof-of-Work ---

const POW_DIFFICULTY = 3
const POW_CHALLENGE_TTL_MS = 5 * 60_000
const powChallenges = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of powChallenges.entries()) {
    if (now - v.createdAt > POW_CHALLENGE_TTL_MS) powChallenges.delete(k)
  }
}, 60_000).unref?.()

function verifyPow(challenge, nonce, difficulty) {
  if (!challenge || !nonce) return false
  const prefix = '0'.repeat(difficulty)
  const hash = createHash('sha256').update(`${challenge}:${nonce}`).digest('hex')
  return hash.startsWith(prefix)
}

// --- Nonce replay-protection (LRU) ---

const usedNonces = new Map()
const MAX_NONCES = 10_000
setInterval(() => {
  const cutoff = Date.now() - 2 * 60_000
  for (const [n, t] of usedNonces.entries()) {
    if (t < cutoff) usedNonces.delete(n)
  }
}, 30_000).unref?.()

// --- Проверка подписи ---

function verifySignature(body, fingerprint) {
  if (!signingSecret) return true // нет секрета — выключено
  const { action, payload, timestamp, nonce, signature } = body
  if (!action || typeof payload !== 'string' || !timestamp || !nonce || !signature) return false

  const now = Date.now()
  if (Math.abs(now - Number(timestamp)) > 30_000) return false

  if (usedNonces.has(nonce)) return false

  const input = `${action}:${payload}:${timestamp}:${nonce}:${fingerprint || ''}`
  const expected = createHmac('sha256', signingSecret).update(input).digest('hex')

  const sigBuf = Buffer.from(String(signature), 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  if (sigBuf.length !== expBuf.length) return false
  if (!timingSafeEqual(sigBuf, expBuf)) return false

  usedNonces.set(nonce, now)
  if (usedNonces.size > MAX_NONCES) {
    const firstKey = usedNonces.keys().next().value
    usedNonces.delete(firstKey)
  }
  return true
}

// --- CAPTCHA ---

async function verifyCaptcha(token, ip, secret) {
  try {
    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    const data = await res.json()
    return data.success === true
  } catch (err) {
    console.error('[BFF CAPTCHA] Ошибка:', err)
    return false
  }
}

// --- Утилиты ---

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0].trim()
  return req.ip || req.socket.remoteAddress || '127.0.0.1'
}

function resolvePathParams(template, params) {
  const remaining = { ...params }
  const resolved = template.replace(/:(\w+)/g, (_, key) => {
    const v = remaining[key]
    delete remaining[key]
    return v != null ? encodeURIComponent(String(v)) : ''
  })
  return { resolvedPath: resolved, remainingParams: remaining }
}

function buildQueryString(params) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== undefined && v !== null) sp.append(key, String(v))
      })
    } else if (typeof value === 'boolean') {
      sp.append(key, value ? 'true' : 'false')
    } else {
      sp.append(key, String(value))
    }
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// --- Express ---

const app = express()
const rateLimiter = new ServerRateLimiter()
app.set('trust proxy', true)
app.use(express.json({ limit: '1mb' }))

// PoW challenge
app.get('/api/pow-challenge', (req, res) => {
  const ip = getClientIp(req)
  const challenge = createHash('sha256')
    .update(`${ip}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 32)
  powChallenges.set(challenge, { createdAt: Date.now(), ip })
  res.json({ challenge, difficulty: POW_DIFFICULTY })
})

// BFF Proxy
app.post('/api/proxy', async (req, res) => {
  try {
    const body = req.body || {}
    const ip = getClientIp(req)
    const fp = req.headers['x-client-fp'] || ''
    const isSearch = !!body.search || !!(ACTION_ROUTE_MAP[body.action]?.isSearch)

    // 1) Rate limit
    const limit = rateLimiter.check(ip, fp, isSearch)
    if (limit.limited) {
      return res
        .status(429)
        .set('Retry-After', String(limit.retryAfterSec))
        .json({ error: 'Слишком много запросов', retryAfter: limit.retryAfterSec })
    }

    // 2) CAPTCHA эскалация
    if (limit.captchaRequired) {
      const token = req.headers['x-captcha-token']
      if (!token) {
        return res.status(403).json({ error: 'Требуется CAPTCHA', captchaRequired: true })
      }
      if (HCAPTCHA_SECRET) {
        const ok = await verifyCaptcha(token, ip, HCAPTCHA_SECRET)
        if (!ok) {
          return res.status(403).json({ error: 'Невалидный CAPTCHA-токен', captchaRequired: true })
        }
      }
    }

    // 3) PoW
    const powChallenge = req.headers['x-pow-challenge']
    const powNonce = req.headers['x-pow-nonce']
    if (!powChallenge || !powNonce) {
      return res.status(403).json({ error: 'Требуется Proof-of-Work', powRequired: true })
    }
    const rec = powChallenges.get(powChallenge)
    if (!rec) {
      return res.status(403).json({ error: 'Невалидный PoW challenge', powRequired: true })
    }
    if (Date.now() - rec.createdAt > POW_CHALLENGE_TTL_MS) {
      powChallenges.delete(powChallenge)
      return res.status(403).json({ error: 'PoW challenge просрочен', powRequired: true })
    }
    if (!verifyPow(powChallenge, powNonce, POW_DIFFICULTY)) {
      return res.status(403).json({ error: 'Неверное PoW-решение', powRequired: true })
    }
    powChallenges.delete(powChallenge)

    // 4) Подпись
    if (!verifySignature(body, fp)) {
      return res.status(403).json({ error: 'Неверная подпись запроса' })
    }

    // 5) Slowdown
    if (limit.slowdownMs > 0) {
      await new Promise((r) => setTimeout(r, limit.slowdownMs))
    }

    rateLimiter.record(ip, fp, isSearch)

    // 6) Маршрутизация
    const route = ACTION_ROUTE_MAP[body.action]
    if (!route) {
      return res.status(400).json({ error: 'Неизвестное действие' })
    }

    const params = typeof body.payload === 'string' ? JSON.parse(body.payload) : {}
    const { resolvedPath, remainingParams } = resolvePathParams(route.path, params)

    let targetUrl = `${API_TARGET}${resolvedPath}`
    const fetchOptions = {
      method: route.method,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-Api-Key': API_KEY } : {}),
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
    }

    if (route.method === 'GET' || route.method === 'DELETE') {
      targetUrl += buildQueryString(remainingParams)
    } else {
      // POST/PUT/PATCH — если есть __body (сырое тело-массив/примитив), используем его
      const payloadBody =
        remainingParams && Object.prototype.hasOwnProperty.call(remainingParams, '__body')
          ? remainingParams.__body
          : remainingParams
      fetchOptions.body = JSON.stringify(payloadBody ?? {})
    }

    console.log(`[BFF Proxy] ${route.method} ${targetUrl} (${route.name})`)
    const apiResponse = await fetch(targetUrl, fetchOptions)
    const responseBody = await apiResponse.text()

    res
      .status(apiResponse.status)
      .set('Content-Type', apiResponse.headers.get('content-type') || 'application/json')
      .send(responseBody)
  } catch (err) {
    console.error('[BFF Proxy] Ошибка:', err)
    res.status(500).json({ error: 'Внутренняя ошибка прокси' })
  }
})

// --- Статика ---
const distPath = path.resolve(__dirname, 'dist')
app.use(express.static(distPath, { index: false }))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BFF] Сервер запущен: http://0.0.0.0:${PORT}`)
  console.log(`[BFF] API_TARGET=${API_TARGET}`)
  console.log(`[BFF] API_KEY=${API_KEY ? 'задан' : 'не задан'}`)
  console.log(`[BFF] SITE_URL=${SITE_URL}`)
  console.log(`[BFF] HCAPTCHA_SECRET=${HCAPTCHA_SECRET ? 'задан' : 'не задан'}`)
  console.log(`[BFF] BUILD_SALT=${buildSalt ? 'задан' : 'НЕТ'}`)
  console.log(`[BFF] SIGNING_SECRET=${signingSecret ? 'задан' : 'НЕТ'}`)
  console.log(`[BFF] Зарегистрировано действий: ${Object.keys(ACTION_ROUTE_MAP).length}`)
})
