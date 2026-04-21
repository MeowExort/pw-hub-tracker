/**
 * Серверный RiskScorer для BFF.
 *
 * На основе сигналов (rate-limit state, поведение клиента, связность
 * сессии, ASN и т.д.) возвращает числовой score 0..100 и список причин.
 *
 * Эскалация (в `/api/proxy`):
 *   0..39  — пропускать;
 *   40..69 — slowdown + увеличенная сложность PoW (hook);
 *   70..89 — требовать CAPTCHA;
 *   90+    — 403 + временный бан (ip+fp) на 10 минут.
 *
 * Веса конфигурируются через переменные окружения `RISK_W_*`.
 */

/** Целочисленные веса сигналов (по умолчанию). */
const DEFAULT_WEIGHTS = {
  rateLimitRatio: 30, // максимум при ratio ~= 1.0
  behaviorMissing: 25, // заголовок отсутствует/невалиден
  behaviorBot: 20, // поведенческие признаки бота (нет мыши/ввода)
  lowEntropy: 20, // низкое разнообразие action+params
  noSession: 15, // первый запрос без прогрева GET /
  datacenterAsn: 30, // IP из известного датацентра
  freshFp: 15, // fingerprint впервые видим и без session token
  lowIntervalCv: 20, // коэффициент вариации интервалов между запросами < 0.1
  onlyMarket: 10, // > 30 market-запросов за 5 мин и 0 не-market
}

/** Загрузить веса с учётом env (`RISK_W_rateLimitRatio` и т.п.). */
function loadWeights(env = process.env) {
  const w = { ...DEFAULT_WEIGHTS }
  for (const key of Object.keys(w)) {
    const envKey = `RISK_W_${key}`
    const raw = env[envKey]
    if (raw !== undefined && raw !== '') {
      const n = Number(raw)
      if (Number.isFinite(n)) w[key] = n
    }
  }
  return w
}

const DEFAULT_CFG = loadWeights()

/**
 * @param {string} header — base64url(JSON) заголовка X-Behavior.
 * @returns {{ valid: boolean, snapshot: object | null }}
 */
export function parseBehaviorHeader(header) {
  if (!header || typeof header !== 'string') return { valid: false, snapshot: null }
  try {
    const b64 = header.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = Buffer.from(b64 + pad, 'base64').toString('utf-8')
    const obj = JSON.parse(json)
    if (!obj || typeof obj !== 'object') return { valid: false, snapshot: null }
    return { valid: true, snapshot: obj }
  } catch {
    return { valid: false, snapshot: null }
  }
}

/**
 * Оценить риск.
 *
 * @param {object} input
 * @param {string} input.ip
 * @param {string} input.fp
 * @param {string|undefined} input.behaviorHeader — сырой заголовок X-Behavior (base64url).
 * @param {{ipRatio?: number, fpRatio?: number, searchRatio?: number}} [input.limitState]
 * @param {{isDatacenter?: boolean}} [input.asn]
 * @param {{isFreshFp?: boolean, hasSessionToken?: boolean, hasWarmupVisit?: boolean}} [input.session]
 * @param {{uniqueRatio?: number, sampleSize?: number, intervalCv?: number, marketCount?: number, nonMarketCount?: number, windowMs?: number}} [input.entropy]
 * @param {object} [weights] — переопределение весов.
 * @returns {{ score: number, reasons: string[], behavior: object|null }}
 */
export function scoreRisk(input, weights = DEFAULT_CFG) {
  const reasons = []
  let score = 0
  const w = weights

  // 1. Превышение rate-limit по IP/FP/search
  const ipRatio = input.limitState?.ipRatio ?? 0
  const fpRatio = input.limitState?.fpRatio ?? 0
  const searchRatio = input.limitState?.searchRatio ?? 0
  const maxRatio = Math.max(ipRatio, fpRatio, searchRatio)
  if (maxRatio >= 0.8) {
    // линейно от 0.8..1.0 → 0..w.rateLimitRatio
    const over = Math.min(1, (maxRatio - 0.8) / 0.2)
    const pts = Math.round(over * w.rateLimitRatio)
    if (pts > 0) {
      score += pts
      reasons.push(`rateLimitRatio=${maxRatio.toFixed(2)} (+${pts})`)
    }
  }

  // 2. Поведенческий заголовок
  const parsed = parseBehaviorHeader(input.behaviorHeader)
  if (!parsed.valid) {
    score += w.behaviorMissing
    reasons.push(`behaviorMissing (+${w.behaviorMissing})`)
  } else {
    const s = parsed.snapshot || {}
    // Полное отсутствие взаимодействий в нескольких измерениях — признак бота.
    const mm = num(s.mm)
    const kd = num(s.kd)
    const sc = num(s.sc)
    const tc = num(s.tc)
    const fc = num(s.fc)
    const sa = num(s.sa)
    const tp = typeof s.tp === 'string' ? s.tp : 'none'
    const totalSignals = mm + kd + sc + tc + fc
    // Если сессия "достаточно живая" (>10с) и нет ни одного взаимодействия — штраф.
    if (sa >= 10_000 && totalSignals === 0) {
      score += w.behaviorBot
      reasons.push(`behaviorBot:noInteraction (+${w.behaviorBot})`)
    } else if (tp === 'paste' && mm === 0) {
      // Вставка без движений мыши — подозрительно.
      score += Math.round(w.behaviorBot / 2)
      reasons.push(`behaviorBot:pasteNoMouse (+${Math.round(w.behaviorBot / 2)})`)
    }
  }

  // 3. Низкая энтропия запросов
  const uniqueRatio = input.entropy?.uniqueRatio
  const sampleSize = input.entropy?.sampleSize ?? 0
  if (typeof uniqueRatio === 'number' && sampleSize >= 10 && uniqueRatio < 0.2) {
    score += w.lowEntropy
    reasons.push(`lowEntropy=${uniqueRatio.toFixed(2)} (+${w.lowEntropy})`)
  }

  // 3b. Слишком равномерные интервалы между запросами (низкий CV) — признак бота.
  const intervalCv = input.entropy?.intervalCv
  if (typeof intervalCv === 'number' && sampleSize >= 10 && intervalCv < 0.1) {
    score += w.lowIntervalCv
    reasons.push(`lowIntervalCv=${intervalCv.toFixed(3)} (+${w.lowIntervalCv})`)
  }

  // 3c. Только market-запросы за последние 5 мин (>30) — парсер, не просматривает сайт.
  const marketCount = input.entropy?.marketCount ?? 0
  const nonMarketCount = input.entropy?.nonMarketCount ?? 0
  if (marketCount > 30 && nonMarketCount === 0) {
    score += w.onlyMarket
    reasons.push(`onlyMarket=${marketCount} (+${w.onlyMarket})`)
  }

  // 4. Нет прогрева GET /
  if (input.session?.hasWarmupVisit === false) {
    score += w.noSession
    reasons.push(`noWarmupVisit (+${w.noSession})`)
  }

  // 5. ASN датацентра
  if (input.asn?.isDatacenter === true) {
    score += w.datacenterAsn
    reasons.push(`datacenterAsn (+${w.datacenterAsn})`)
  }

  // 6. Свежий fp без session token
  if (input.session?.isFreshFp === true && input.session?.hasSessionToken !== true) {
    score += w.freshFp
    reasons.push(`freshFpNoSession (+${w.freshFp})`)
  }

  if (score < 0) score = 0
  if (score > 100) score = 100

  return { score, reasons, behavior: parsed.snapshot }
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * Простая in-memory база прогретых fingerprint (посещение GET /).
 * TTL 10 минут.
 */
const WARMUP_TTL_MS = 10 * 60_000
const warmupFp = new Map()

export function markWarmupVisit(fp) {
  if (!fp) return
  warmupFp.set(fp, Date.now())
}

export function hasWarmupVisit(fp) {
  if (!fp) return false
  const t = warmupFp.get(fp)
  if (!t) return false
  if (Date.now() - t > WARMUP_TTL_MS) {
    warmupFp.delete(fp)
    return false
  }
  return true
}

setInterval(() => {
  const cutoff = Date.now() - WARMUP_TTL_MS
  for (const [k, t] of warmupFp.entries()) {
    if (t < cutoff) warmupFp.delete(k)
  }
}, 60_000).unref?.()

/** Известные fingerprint (для определения "свежего"). */
const knownFp = new Map()
const KNOWN_FP_TTL_MS = 24 * 60 * 60 * 1000

export function isFreshFingerprint(fp) {
  if (!fp) return true
  const t = knownFp.get(fp)
  if (!t) {
    knownFp.set(fp, Date.now())
    return true
  }
  knownFp.set(fp, Date.now())
  return false
}

setInterval(() => {
  const cutoff = Date.now() - KNOWN_FP_TTL_MS
  for (const [k, t] of knownFp.entries()) {
    if (t < cutoff) knownFp.delete(k)
  }
}, 5 * 60_000).unref?.()

/**
 * Энтропия/связность: кольцевой буфер последних N запросов на fp.
 * Сигналы: uniqueRatio (доля уникальных action+paramsHash).
 */
const ENTROPY_BUFFER_SIZE = 50
const ENTROPY_TTL_MS = 15 * 60_000
const entropyByFp = new Map()

export function recordRequestForEntropy(fp, actionId, paramsHash, isMarket = true) {
  if (!fp) return
  const now = Date.now()
  let buf = entropyByFp.get(fp)
  if (!buf) {
    buf = []
    entropyByFp.set(fp, buf)
  }
  buf.push({ action: actionId || '', params: paramsHash || '', ts: now, isMarket: !!isMarket })
  if (buf.length > ENTROPY_BUFFER_SIZE) buf.shift()
}

export function getEntropyStats(fp) {
  const empty = {
    uniqueRatio: 1,
    sampleSize: 0,
    intervalCv: null,
    marketCount: 0,
    nonMarketCount: 0,
    windowMs: ENTROPY_TTL_MS,
  }
  if (!fp) return empty
  const buf = entropyByFp.get(fp)
  if (!buf || buf.length === 0) return empty
  const cutoff = Date.now() - ENTROPY_TTL_MS
  const recent = buf.filter((r) => r.ts > cutoff)
  if (recent.length === 0) return empty
  const keys = new Set(recent.map((r) => `${r.action}|${r.params}`))

  // CV интервалов между соседними запросами (за окно 15 мин).
  let intervalCv = null
  if (recent.length >= 5) {
    const intervals = []
    for (let i = 1; i < recent.length; i++) {
      intervals.push(recent[i].ts - recent[i - 1].ts)
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
    if (mean > 0) {
      const variance =
        intervals.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / intervals.length
      const std = Math.sqrt(variance)
      intervalCv = std / mean
    }
  }

  // Окно 5 минут для market/non-market счёта.
  const fiveMinCutoff = Date.now() - 5 * 60_000
  let marketCount = 0
  let nonMarketCount = 0
  for (const r of recent) {
    if (r.ts <= fiveMinCutoff) continue
    if (r.isMarket) marketCount++
    else nonMarketCount++
  }

  return {
    uniqueRatio: keys.size / recent.length,
    sampleSize: recent.length,
    intervalCv,
    marketCount,
    nonMarketCount,
    windowMs: ENTROPY_TTL_MS,
  }
}

setInterval(() => {
  const cutoff = Date.now() - ENTROPY_TTL_MS
  for (const [fp, buf] of entropyByFp.entries()) {
    const kept = buf.filter((r) => r.ts > cutoff)
    if (kept.length === 0) entropyByFp.delete(fp)
    else entropyByFp.set(fp, kept)
  }
}, 60_000).unref?.()

/** Временный бан (ip+fp → expiresAt). */
const bans = new Map()
const BAN_MS = 10 * 60_000

function banKey(ip, fp) {
  return `${ip}|${fp || ''}`
}

export function isBanned(ip, fp) {
  const key = banKey(ip, fp)
  const exp = bans.get(key)
  if (!exp) return false
  if (Date.now() > exp) {
    bans.delete(key)
    return false
  }
  return true
}

export function addBan(ip, fp, ttlMs = BAN_MS) {
  bans.set(banKey(ip, fp), Date.now() + ttlMs)
}

export function clearBanForTests() {
  bans.clear()
}

/** Отладочный вывод (для тестов). */
export const __internals = {
  warmupFp,
  knownFp,
  entropyByFp,
  bans,
  DEFAULT_WEIGHTS,
}
