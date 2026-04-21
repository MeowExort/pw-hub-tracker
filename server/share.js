/**
 * Хранилище шаров подборок (коротких ссылок).
 *
 * Основное хранилище — Redis (см. `./redis.js`):
 *   pwhub:tracker:share:{code} — Hash: { kind, payload(JSON), createdAt, expiresAt, hits }
 *                                c EXPIREAT на момент expiresAt (TTL делает Redis).
 *
 * Если Redis недоступен, автоматически используется in-memory fallback
 * (Map<code, ShareEntry>). FIFO-эвикт применяется только к in-memory fallback;
 * в Redis ограничение по количеству не навязываем — там TTL всё чистит сам.
 *
 * Каждая запись — публичный JSON-снимок подборки, доступный по короткому коду.
 * TTL по умолчанию — 30 дней; истёкшие записи Redis удаляет автоматически,
 * in-memory fallback чистит лениво при чтении и создании.
 */

import { randomBytes } from 'crypto'
import { getRedis } from './redis.js'

/**
 * @typedef {Object} ShareEntry
 * @property {string} code
 * @property {string} kind
 * @property {any}    payload
 * @property {number} createdAt
 * @property {number} expiresAt
 * @property {number} hits
 */

const MAX_PAYLOAD_BYTES = 64 * 1024 // 64 KiB на шару с запасом
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ENTRIES = 10_000

// --- In-memory fallback ---
/** @type {Map<string, ShareEntry>} */
const byCode = new Map()

const K_SHARE = (code) => `share:${code}`

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function generateCode(len = 8) {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += BASE62[bytes[i] % BASE62.length]
  return out
}

function byteSize(obj) {
  try {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8')
  } catch {
    return Infinity
  }
}

function sweepExpiredMemory(now = Date.now()) {
  let removed = 0
  for (const [code, e] of byCode) {
    if (e.expiresAt <= now) {
      byCode.delete(code)
      removed++
    }
  }
  return removed
}

function enforceCapacityMemory() {
  if (byCode.size <= MAX_ENTRIES) return
  const entries = [...byCode.values()].sort((a, b) => a.createdAt - b.createdAt)
  const toRemove = byCode.size - MAX_ENTRIES
  for (let i = 0; i < toRemove; i++) byCode.delete(entries[i].code)
}

/**
 * Создать запись шары.
 * @param {{ kind?: string, payload: any, ttlMs?: number }} input
 * @returns {Promise<{ code: string, expiresAt: number }>}
 */
export async function createShare(input) {
  if (!input || typeof input !== 'object') throw new Error('payload required')
  const kind = String(input.kind || 'collection')
  const payload = input.payload
  if (payload == null || typeof payload !== 'object') {
    throw new Error('payload must be an object')
  }
  const size = byteSize(payload)
  if (!Number.isFinite(size) || size > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload too large (${size} bytes, max ${MAX_PAYLOAD_BYTES})`)
  }

  const now = Date.now()
  const ttl = Number.isFinite(+input.ttlMs) && +input.ttlMs > 0
    ? Math.min(+input.ttlMs, DEFAULT_TTL_MS)
    : DEFAULT_TTL_MS
  const expiresAt = now + ttl

  const r = getRedis()
  if (r) {
    try {
      // Генерируем код с проверкой коллизии через SETNX-подобный sentinel.
      let code = generateCode()
      for (let i = 0; i < 5; i++) {
        const exists = await r.exists(K_SHARE(code))
        if (!exists) break
        code = generateCode()
      }
      const pipe = r.pipeline()
      pipe.hset(K_SHARE(code), {
        code,
        kind,
        payload: JSON.stringify(payload),
        createdAt: String(now),
        expiresAt: String(expiresAt),
        hits: '0',
      })
      pipe.pexpireat(K_SHARE(code), expiresAt)
      await pipe.exec()
      return { code, expiresAt }
    } catch (e) {
      console.warn('[share] createShare redis error, fallback:', e?.message || e)
    }
  }

  // In-memory
  sweepExpiredMemory(now)
  let code = generateCode()
  for (let i = 0; i < 5 && byCode.has(code); i++) code = generateCode()
  if (byCode.has(code)) code = generateCode(10)

  const entry = { code, kind, payload, createdAt: now, expiresAt, hits: 0 }
  byCode.set(code, entry)
  enforceCapacityMemory()
  return { code, expiresAt }
}

/**
 * Прочитать шару по коду.
 * @param {string} code
 * @returns {Promise<ShareEntry | null>}
 */
export async function readShare(code) {
  if (!code || typeof code !== 'string') return null

  const r = getRedis()
  if (r) {
    try {
      const h = await r.hgetall(K_SHARE(code))
      if (!h || !h.code) return null
      const expiresAt = Number(h.expiresAt)
      if (!expiresAt || expiresAt <= Date.now()) {
        // Подстраховка: Redis уже должен был удалить, но на всякий случай.
        await r.del(K_SHARE(code)).catch(() => {})
        return null
      }
      // Счётчик попаданий — атомарно.
      let hits = 0
      try {
        hits = await r.hincrby(K_SHARE(code), 'hits', 1)
      } catch {
        hits = Number(h.hits) || 0
      }
      let payload
      try {
        payload = JSON.parse(h.payload)
      } catch {
        return null
      }
      return {
        code: h.code,
        kind: h.kind,
        payload,
        createdAt: Number(h.createdAt) || 0,
        expiresAt,
        hits,
      }
    } catch (e) {
      console.warn('[share] readShare redis error, fallback:', e?.message || e)
    }
  }

  const entry = byCode.get(code)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    byCode.delete(code)
    return null
  }
  entry.hits += 1
  return entry
}

/** Для тестов/диагностики (только in-memory fallback). */
export function _debugStats() {
  return { size: byCode.size }
}
