/**
 * Генерация карточек-превью (Open Graph / Twitter Card) для страниц SPA.
 *
 * Для «красивых» превью ссылок в Telegram, Discord, Twitter/X, VK, Slack,
 * WhatsApp, LinkedIn и прочих мессенджерах нужны серверные <meta>-теги в HTML.
 * SPA отдаёт один и тот же `dist/index.html`, поэтому мы перехватываем
 * запросы к профильным страницам (игрок/команда/магазин/предмет) и
 * инжектим в <head> подготовленные OG-теги, предварительно подтянув данные
 * из внутреннего API.
 *
 * Поддерживаемые маршруты:
 *   /players/:server/:playerId  — профиль игрока
 *   /teams/:teamId              — профиль команды
 *   /shops/:server/:playerId    — профиль магазина игрока
 *   /items/:id                  — профиль предмета
 *
 * Поведение — всегда инжектить теги (а не только ботам по UA):
 *  + боты гарантированно видят карточку;
 *  + люди получают корректные OG-теги при копировании ссылки.
 */

import { readFileSync } from 'fs'
import path from 'path'

/** Названия классов персонажей (должно совпадать с src/shared/utils/format.ts). */
const CLASS_NAMES = {
  0: 'Воин',
  1: 'Маг',
  2: 'Шаман',
  3: 'Друид',
  4: 'Оборотень',
  5: 'Убийца',
  6: 'Лучник',
  7: 'Жрец',
  8: 'Страж',
  9: 'Мистик',
  10: 'Призрак',
  11: 'Жнец',
  12: 'Стрелок',
  13: 'Паладин',
  14: 'Странник',
  15: 'Бард',
  16: 'Дух крови',
}

/** Пути к иконкам классов (публичная статика из dist/). */
const CLASS_ICONS = {
  0: '/assets/classes/var.png',
  1: '/assets/classes/mag.png',
  2: '/assets/classes/sham.png',
  3: '/assets/classes/dru.png',
  4: '/assets/classes/tank.png',
  5: '/assets/classes/sin.png',
  6: '/assets/classes/luk.png',
  7: '/assets/classes/prist.png',
  8: '/assets/classes/sik.png',
  9: '/assets/classes/mist.png',
  10: '/assets/classes/gost.png',
  11: '/assets/classes/kosa.png',
  12: '/assets/classes/gan.png',
  13: '/assets/classes/pal.png',
  14: '/assets/classes/mk.png',
  15: '/assets/classes/bard.png',
  16: '/assets/classes/dk.png',
}

/** Названия серверов — для более читаемого описания. */
const SERVER_NAMES_BY_ZONE = {
  2: 'Центавр',
  3: 'Фенрир',
  5: 'Мицар',
  29: 'Капелла',
}

/** Человеческие названия серверов по строковому коду из URL. */
const SERVER_NAMES_BY_CODE = {
  centaur: 'Центавр',
  fenrir: 'Фенрир',
  mizar: 'Мицар',
  capella: 'Капелла',
}

function getClassName(cls) {
  return CLASS_NAMES[cls] ?? `Класс ${cls}`
}

function getClassIcon(cls) {
  return CLASS_ICONS[cls] ?? ''
}

function getServerNameByCode(code) {
  if (!code) return ''
  const key = String(code).toLowerCase()
  return SERVER_NAMES_BY_CODE[key] ?? code
}

function getServerNameByZone(zoneId) {
  return SERVER_NAMES_BY_ZONE[zoneId] ?? `Сервер ${zoneId}`
}

/** HTML-экранирование для вставки значений в атрибуты <meta content="..."> */
export function escapeHtmlAttr(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Собирает абсолютный URL: если value уже абсолютный — возвращает как есть. */
export function absoluteUrl(siteUrl, value) {
  if (!value) return ''
  const s = String(value)
  if (/^https?:\/\//i.test(s)) return s
  const base = String(siteUrl || '').replace(/\/$/, '')
  const rel = s.startsWith('/') ? s : `/${s}`
  return `${base}${rel}`
}

/** Форматирует число с разделителями тысяч (RU). */
function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  try {
    return Number(n).toLocaleString('ru-RU')
  } catch {
    return String(n)
  }
}

/* ────────────────────────────── Роутинг ────────────────────────────── */

/**
 * Определяет тип страницы и её параметры по pathname.
 * Возвращает null, если путь не относится к профильной странице.
 */
export function matchOgRoute(pathname) {
  if (!pathname) return null

  // /players/:server/:playerId
  let m = /^\/players\/([^/]+)\/(\d+)\/?$/.exec(pathname)
  if (m) return { type: 'player', server: decodeURIComponent(m[1]), playerId: Number(m[2]) }

  // /teams/:teamId
  m = /^\/teams\/(\d+)\/?$/.exec(pathname)
  if (m) return { type: 'team', teamId: Number(m[1]) }

  // /shops/:server/:playerId
  m = /^\/shops\/([^/]+)\/(\d+)\/?$/.exec(pathname)
  if (m) return { type: 'shop', server: decodeURIComponent(m[1]), playerId: Number(m[2]) }

  // /items/:id
  m = /^\/items\/(\d+)\/?$/.exec(pathname)
  if (m) return { type: 'item', itemId: Number(m[1]) }

  return null
}

/* ───────────────────────────── Fetch helpers ──────────────────────────── */

async function fetchJson(apiTarget, apiKey, pathname, { timeoutMs = 4000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${apiTarget}${pathname}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/* ─────────────────────── Построение данных карточек ──────────────────── */

async function buildPlayerCard({ apiTarget, apiKey, siteUrl, server, playerId, requestUrl }) {
  const data = await fetchJson(apiTarget, apiKey, `/api/arena/players/${encodeURIComponent(server)}/${playerId}`)
  const name = data?.name || `Игрок #${playerId}`
  const cls = typeof data?.cls === 'number' ? data.cls : null
  const className = cls !== null ? getClassName(cls) : ''
  const serverName = getServerNameByCode(server)
  const teamName = data?.team?.name || data?.teamName || null

  const titleParts = [name]
  if (className) titleParts.push(`— ${className}`)
  const title = `${titleParts.join(' ')} · PW Hub Tracker`

  const descParts = []
  if (className) descParts.push(`Класс: ${className}`)
  if (serverName) descParts.push(`Сервер: ${serverName}`)
  if (teamName) descParts.push(`Команда: ${teamName}`)
  if (Array.isArray(data?.battleStats) && data.battleStats.length > 0) {
    const best = data.battleStats.reduce(
      (acc, s) => (s && typeof s.score === 'number' && s.score > acc ? s.score : acc),
      0,
    )
    if (best > 0) descParts.push(`Рейтинг: ${fmtInt(best)}`)
  }
  const description = descParts.length > 0
    ? descParts.join(' • ')
    : 'Профиль игрока в PW Hub Tracker.'

  const iconRel = cls !== null ? getClassIcon(cls) : ''
  const image = iconRel ? absoluteUrl(siteUrl, iconRel) : ''

  return { title, description, image, url: requestUrl, type: 'profile' }
}

async function buildTeamCard({ apiTarget, apiKey, siteUrl, teamId, requestUrl }) {
  const data = await fetchJson(apiTarget, apiKey, `/api/arena/teams/${teamId}`)
  const name = data?.name || `Команда #${teamId}`
  const title = `${name} · PW Hub Tracker`

  const descParts = []
  if (typeof data?.zoneId === 'number') descParts.push(`Сервер: ${getServerNameByZone(data.zoneId)}`)
  if (Array.isArray(data?.members)) descParts.push(`Состав: ${data.members.length} чел.`)
  if (Array.isArray(data?.battleStats) && data.battleStats.length > 0) {
    const best = data.battleStats.reduce(
      (acc, s) => (s && typeof s.score === 'number' && s.score > acc ? s.score : acc),
      0,
    )
    if (best > 0) descParts.push(`Рейтинг: ${fmtInt(best)}`)
  }
  const description = descParts.length > 0
    ? descParts.join(' • ')
    : 'Профиль команды в PW Hub Tracker.'

  // По ТЗ — для команды картинка не используется.
  return { title, description, image: '', url: requestUrl, type: 'profile' }
}

async function buildShopCard({ apiTarget, apiKey, siteUrl, server, playerId, requestUrl }) {
  const data = await fetchJson(
    apiTarget,
    apiKey,
    `/api/pshop/v2/players/${encodeURIComponent(server)}/${playerId}/shop-profile?itemsLimit=1`,
  )
  const playerName = data?.player?.name || `Игрок #${playerId}`
  const serverName = getServerNameByCode(server)
  const title = `Магазин · ${playerName} · PW Hub Tracker`

  const descParts = []
  if (serverName) descParts.push(`Сервер: ${serverName}`)
  if (Array.isArray(data?.items)) {
    const sellCount = data.items.filter((x) => x && x.isSell).length
    const buyCount = data.items.filter((x) => x && x.isSell === false).length
    if (sellCount || buyCount) descParts.push(`Лотов: продажа ${sellCount}, скупка ${buyCount}`)
  }
  if (data?.shop && data.shop.isActive === false) descParts.push('Неактивен')
  const description = descParts.length > 0
    ? descParts.join(' • ')
    : 'Персональный магазин игрока в PW Hub Tracker.'

  // По ТЗ — для магазина картинка не используется.
  return { title, description, image: '', url: requestUrl, type: 'profile' }
}

async function buildItemCard({ apiTarget, apiKey, siteUrl, itemId, requestUrl }) {
  // ItemDetails требует server; берём любой валидный, чтобы получить общую карточку.
  // Если server-параметр отсутствует или неизвестен — API должно вернуть info для itemId.
  // Пробуем наиболее распространённые серверы по очереди.
  const serverCandidates = ['centaur', 'fenrir', 'mizar', 'capella']
  let data = null
  for (const srv of serverCandidates) {
    data = await fetchJson(
      apiTarget,
      apiKey,
      `/api/pshop/v2/items/${itemId}/details?server=${srv}&offersLimit=0&historyPeriod=7d`,
    )
    if (data?.info?.name) break
  }

  const info = data?.info
  const name = info?.name || `Предмет #${itemId}`
  const title = `${name} · PW Hub Tracker`

  const descParts = []
  if (info?.category) descParts.push(`Категория: ${info.category}`)
  if (info?.sell && typeof info.sell.avg === 'number' && info.sell.avg > 0) {
    descParts.push(`Цена продажи: ~${fmtInt(Math.round(info.sell.avg))}`)
  }
  if (info?.buy && typeof info.buy.avg === 'number' && info.buy.avg > 0) {
    descParts.push(`Цена скупки: ~${fmtInt(Math.round(info.buy.avg))}`)
  }
  if (info?.description) {
    // первая строка описания
    const firstLine = String(info.description).split(/\r?\n/)[0].trim()
    if (firstLine) descParts.push(firstLine)
  }
  const description = descParts.length > 0
    ? descParts.join(' • ')
    : 'Информация о предмете в PW Hub Tracker.'

  const image = info?.icon ? absoluteUrl(siteUrl, info.icon) : ''
  return { title, description, image, url: requestUrl, type: 'article' }
}

/* ────────────────────────── Формирование тегов ───────────────────────── */

/**
 * Возвращает блок <meta>-тегов для карточки. Теги покрывают:
 *  - Open Graph (og:*) — Facebook, Telegram, Discord, VK, WhatsApp, LinkedIn и др.
 *  - Twitter Card — Twitter/X.
 *  - Стандартные <title> и <meta name="description">.
 */
export function buildMetaTags({ title, description, image, url, type = 'website' }) {
  const safeTitle = escapeHtmlAttr(title)
  const safeDesc = escapeHtmlAttr(description)
  const safeUrl = escapeHtmlAttr(url)
  const safeImage = escapeHtmlAttr(image)
  const safeType = escapeHtmlAttr(type)

  const cardType = image ? 'summary_large_image' : 'summary'

  const lines = [
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDesc}" />`,
    `<meta property="og:site_name" content="PW Hub Tracker" />`,
    `<meta property="og:type" content="${safeType}" />`,
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta property="og:description" content="${safeDesc}" />`,
    `<meta property="og:url" content="${safeUrl}" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta name="twitter:card" content="${cardType}" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`,
    `<meta name="twitter:description" content="${safeDesc}" />`,
  ]
  if (image) {
    lines.push(`<meta property="og:image" content="${safeImage}" />`)
    lines.push(`<meta property="og:image:alt" content="${safeTitle}" />`)
    lines.push(`<meta name="twitter:image" content="${safeImage}" />`)
  }
  return lines.join('\n    ')
}

/**
 * Инжектит блок тегов в HTML, заменяя существующий <title> (если он есть)
 * и вставляя теги сразу после открывающего <head>.
 * Дополнительно удаляет ранее существующие og:... и twitter:... теги, чтобы
 * избежать дублирования с дефолтными из index.html (если такие появятся).
 */
export function injectMeta(html, metaBlock) {
  if (!html) return html
  let out = html

  // Удаляем прежний <title>...</title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, '')
  // Удаляем прежние мета-теги description/og:*/twitter:*
  out = out.replace(
    /\s*<meta\s+(?:name|property)="(?:description|og:[^"]+|twitter:[^"]+)"[^>]*>/gi,
    '',
  )

  // Вставляем новый блок после <head ...>
  const headOpen = /<head(\s[^>]*)?>/i
  if (headOpen.test(out)) {
    out = out.replace(headOpen, (match) => `${match}\n    ${metaBlock}`)
  } else {
    // Нет <head> — просто добавим в начало
    out = `${metaBlock}\n${out}`
  }
  return out
}

/* ───────────────────────── Кэш и основная функция ─────────────────────── */

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 минут
const CACHE_MAX_SIZE = 500
const cardCache = new Map() // key → { at, data }

function cacheGet(key) {
  const hit = cardCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cardCache.delete(key)
    return null
  }
  // refresh LRU
  cardCache.delete(key)
  cardCache.set(key, hit)
  return hit.data
}

function cacheSet(key, data) {
  if (cardCache.size >= CACHE_MAX_SIZE) {
    const firstKey = cardCache.keys().next().value
    if (firstKey !== undefined) cardCache.delete(firstKey)
  }
  cardCache.set(key, { at: Date.now(), data })
}

/** Для тестов — очистка кэша. */
export function _clearOgCache() {
  cardCache.clear()
}

/**
 * Создаёт Express-middleware, который для профильных путей отдаёт
 * `dist/index.html` с инжектированными OG-тегами. Для прочих путей
 * вызывает next().
 */
export function createOgMiddleware({ distPath, apiTarget, apiKey, siteUrl }) {
  return async function ogMiddleware(req, res, next) {
    // Только GET и только HTML-документы (не XHR/assets)
    if (req.method !== 'GET') return next()
    const accept = String(req.headers['accept'] || '')
    if (accept && !accept.includes('text/html') && !accept.includes('*/*')) {
      return next()
    }

    const route = matchOgRoute(req.path)
    if (!route) return next()

    // Абсолютный URL страницы — как og:url
    const origin = `${req.protocol}://${req.get('host')}`
    const requestUrl = `${siteUrl || origin}${req.originalUrl || req.url}`.replace(/\/$/, '')

    // Читаем базовый HTML (c кэшированием по mtime не заморачиваемся — Express.static уже в памяти у ОС)
    let baseHtml
    try {
      baseHtml = readFileSync(path.join(distPath, 'index.html'), 'utf-8')
    } catch {
      // dist не собран — пусть обработает дефолтный fallback
      return next()
    }

    // Ищем в кэше
    const cacheKey = `${route.type}:${route.server || ''}:${route.playerId || route.teamId || route.itemId || ''}`
    let card = cacheGet(cacheKey)
    if (!card) {
      try {
        if (route.type === 'player') {
          card = await buildPlayerCard({ apiTarget, apiKey, siteUrl, requestUrl, ...route })
        } else if (route.type === 'team') {
          card = await buildTeamCard({ apiTarget, apiKey, siteUrl, requestUrl, ...route })
        } else if (route.type === 'shop') {
          card = await buildShopCard({ apiTarget, apiKey, siteUrl, requestUrl, ...route })
        } else if (route.type === 'item') {
          card = await buildItemCard({ apiTarget, apiKey, siteUrl, requestUrl, ...route })
        }
      } catch (err) {
        console.warn('[og-cards] Ошибка построения карточки:', err?.message || err)
      }

      if (!card) {
        // Fallback: отдадим минимальные теги с ссылкой
        card = {
          title: 'PW Hub Tracker',
          description: 'Аналитика и статистика по PW.',
          image: '',
          url: requestUrl,
          type: 'website',
        }
      } else {
        cacheSet(cacheKey, card)
      }
    }

    const metaBlock = buildMetaTags(card)
    const html = injectMeta(baseHtml, metaBlock)
    res.set('Content-Type', 'text/html; charset=utf-8')
    // Короткий shared cache для ботов и людей
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    return res.send(html)
  }
}
