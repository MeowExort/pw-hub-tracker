/**
 * Хранилище таргет-алертов пользователей.
 *
 * Основное хранилище — Redis (см. `./redis.js`):
 *   pwhub:tracker:alerts:{id}          — Hash (сериализованные поля алерта)
 *   pwhub:tracker:alerts:user:{userId} — Set из id алертов пользователя
 *   pwhub:tracker:alerts:active        — Set всех id (индекс для воркера)
 *
 * Если Redis недоступен, автоматически используется in-memory fallback
 * (Map<id, Alert>) — сигнатуры экспортов при этом не меняются.
 *
 * Каждый алерт — «уведоми меня, когда цена на предмет на сервере пересечёт target».
 */

import { randomUUID } from 'crypto'
import { getRedis } from './redis.js'

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} userId
 * @property {number} itemId
 * @property {string} server      'capella' | 'centaur' | 'alkor' | 'mizar'
 * @property {'sell'|'buy'} side
 * @property {number} targetPrice
 * @property {'<='|'>='} direction
 * @property {number} cooldownMin default 30
 * @property {number} [expiresAt] ms epoch
 * @property {number} createdAt   ms epoch
 * @property {number} [lastFiredAt] ms epoch
 */

// --- In-memory fallback ---
/** @type {Map<string, Alert>} */
const alertsById = new Map()

// --- Ключи Redis ---
const K_ALERT = (id) => `alerts:${id}`
const K_USER = (uid) => `alerts:user:${uid}`
const K_ACTIVE = 'alerts:active'

/** Сериализация алерта в строковый hash (Redis HSET). */
function toHash(a) {
  const h = {
    id: a.id,
    userId: a.userId,
    itemId: String(a.itemId),
    server: a.server,
    side: a.side,
    targetPrice: String(a.targetPrice),
    direction: a.direction,
    cooldownMin: String(a.cooldownMin),
    createdAt: String(a.createdAt),
  }
  if (a.expiresAt != null) h.expiresAt = String(a.expiresAt)
  if (a.lastFiredAt != null) h.lastFiredAt = String(a.lastFiredAt)
  return h
}

/** Десериализация hash → Alert. Возвращает null, если данных нет. */
function fromHash(h) {
  if (!h || !h.id) return null
  const a = {
    id: h.id,
    userId: h.userId,
    itemId: Number(h.itemId),
    server: h.server,
    side: h.side === 'buy' ? 'buy' : 'sell',
    targetPrice: Number(h.targetPrice),
    direction: h.direction === '>=' ? '>=' : '<=',
    cooldownMin: Number(h.cooldownMin) || 30,
    createdAt: Number(h.createdAt) || 0,
  }
  if (h.expiresAt != null) a.expiresAt = Number(h.expiresAt)
  if (h.lastFiredAt != null) a.lastFiredAt = Number(h.lastFiredAt)
  return a
}

/** Вернуть список алертов пользователя. */
export async function listAlerts(userId) {
  const r = getRedis()
  if (r) {
    try {
      const ids = await r.smembers(K_USER(userId))
      if (!ids.length) return []
      const pipe = r.pipeline()
      for (const id of ids) pipe.hgetall(K_ALERT(id))
      const results = await pipe.exec()
      const out = []
      for (const [, h] of results) {
        const a = fromHash(h)
        if (a) out.push(a)
      }
      return out.sort((a, b) => b.createdAt - a.createdAt)
    } catch (e) {
      console.warn('[alerts] listAlerts redis error, fallback:', e?.message || e)
    }
  }
  const out = []
  for (const a of alertsById.values()) if (a.userId === userId) out.push(a)
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

/** Создать алерт. */
export async function createAlert(userId, input) {
  const now = Date.now()
  const id = randomUUID()
  /** @type {Alert} */
  const alert = {
    id,
    userId,
    itemId: Number(input.itemId),
    server: String(input.server),
    side: input.side === 'buy' ? 'buy' : 'sell',
    targetPrice: Number(input.targetPrice),
    direction: input.direction === '>=' ? '>=' : '<=',
    cooldownMin: Number.isFinite(+input.cooldownMin) ? +input.cooldownMin : 30,
    expiresAt: input.expiresAt ? Number(input.expiresAt) : undefined,
    createdAt: now,
  }

  const r = getRedis()
  if (r) {
    try {
      const pipe = r.pipeline()
      pipe.hset(K_ALERT(id), toHash(alert))
      pipe.sadd(K_USER(userId), id)
      pipe.sadd(K_ACTIVE, id)
      if (alert.expiresAt) {
        // TTL на сам hash + лениво чистим индексы в deleteExpired.
        const ttlSec = Math.max(1, Math.ceil((alert.expiresAt - now) / 1000))
        pipe.expire(K_ALERT(id), ttlSec)
      }
      await pipe.exec()
      return alert
    } catch (e) {
      console.warn('[alerts] createAlert redis error, fallback:', e?.message || e)
    }
  }
  alertsById.set(id, alert)
  return alert
}

/** Удалить алерт. Возвращает true, если он принадлежал пользователю. */
export async function deleteAlert(userId, id) {
  const r = getRedis()
  if (r) {
    try {
      const owner = await r.hget(K_ALERT(id), 'userId')
      if (!owner || owner !== userId) return false
      const pipe = r.pipeline()
      pipe.del(K_ALERT(id))
      pipe.srem(K_USER(userId), id)
      pipe.srem(K_ACTIVE, id)
      await pipe.exec()
      return true
    } catch (e) {
      console.warn('[alerts] deleteAlert redis error, fallback:', e?.message || e)
    }
  }
  const a = alertsById.get(id)
  if (!a || a.userId !== userId) return false
  alertsById.delete(id)
  return true
}

/** Удалить все истёкшие алерты. Возвращает количество удалённых. */
export async function deleteExpired(now = Date.now()) {
  const r = getRedis()
  if (r) {
    try {
      let removed = 0
      const ids = await r.smembers(K_ACTIVE)
      if (!ids.length) return 0
      const pipe = r.pipeline()
      for (const id of ids) pipe.hmget(K_ALERT(id), 'userId', 'expiresAt')
      const results = await pipe.exec()
      const del = r.pipeline()
      for (let i = 0; i < ids.length; i++) {
        const [, values] = results[i]
        const [userId, expiresAt] = values || []
        const id = ids[i]
        if (!userId) {
          // hash исчез (истёк TTL) — чистим индексы.
          del.srem(K_ACTIVE, id)
          removed++
          continue
        }
        if (expiresAt && Number(expiresAt) < now) {
          del.del(K_ALERT(id))
          del.srem(K_USER(userId), id)
          del.srem(K_ACTIVE, id)
          removed++
        }
      }
      if (removed) await del.exec()
      return removed
    } catch (e) {
      console.warn('[alerts] deleteExpired redis error, fallback:', e?.message || e)
    }
  }
  let removed = 0
  for (const [id, a] of alertsById) {
    if (a.expiresAt && a.expiresAt < now) {
      alertsById.delete(id)
      removed++
    }
  }
  return removed
}

/** Все активные (не истёкшие) алерты — для воркера. */
export async function getActiveAlerts(now = Date.now()) {
  const r = getRedis()
  if (r) {
    try {
      const ids = await r.smembers(K_ACTIVE)
      if (!ids.length) return []
      const pipe = r.pipeline()
      for (const id of ids) pipe.hgetall(K_ALERT(id))
      const results = await pipe.exec()
      const out = []
      for (let i = 0; i < ids.length; i++) {
        const [, h] = results[i]
        const a = fromHash(h)
        if (!a) continue
        if (a.expiresAt && a.expiresAt < now) continue
        out.push(a)
      }
      return out
    } catch (e) {
      console.warn('[alerts] getActiveAlerts redis error, fallback:', e?.message || e)
    }
  }
  const out = []
  for (const a of alertsById.values()) {
    if (a.expiresAt && a.expiresAt < now) continue
    out.push(a)
  }
  return out
}

/** Отметить, что алерт был выпущен (для cooldown). */
export async function markFired(id, ts = Date.now()) {
  const r = getRedis()
  if (r) {
    try {
      await r.hset(K_ALERT(id), 'lastFiredAt', String(ts))
      return
    } catch (e) {
      console.warn('[alerts] markFired redis error, fallback:', e?.message || e)
    }
  }
  const a = alertsById.get(id)
  if (!a) return
  a.lastFiredAt = ts
}

/**
 * В cooldown ли алерт? Функция остаётся синхронной: воркер уже получил
 * актуальное значение `lastFiredAt` в снапшоте `getActiveAlerts`.
 */
export function inCooldown(alert, now = Date.now()) {
  if (!alert.lastFiredAt) return false
  return now - alert.lastFiredAt < alert.cooldownMin * 60_000
}

/** Проверка условия: удовлетворяет ли текущая цена таргету. */
export function priceMatches(alert, price) {
  if (price == null || !Number.isFinite(price)) return false
  return alert.direction === '<=' ? price <= alert.targetPrice : price >= alert.targetPrice
}
