/**
 * Обёртка над `web-push` для BFF.
 *
 * Отвечает за:
 *  • инициализацию VAPID-ключей (из env; если их нет — генерирует на старте в dev);
 *  • хранилище push-подписок в Redis (с in-memory fallback);
 *  • отправку payload одному/всем endpoint'ам пользователя;
 *  • автоматическую очистку «протухших» подписок (410 Gone / 404).
 *
 * Redis-схема:
 *   pwhub:tracker:push:user:{userId}          — Set из endpoint'ов пользователя
 *   pwhub:tracker:push:sub:{userId}:{sha1(endpoint)} — Hash с самим PushSubscription
 *
 * Для прод-окружения ключи обязательно должны быть заданы через env
 * (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).
 */

import { createHash } from 'crypto'
import webpush from 'web-push'
import { getRedis } from './redis.js'

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@pw-hub.local'

let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  const keys = webpush.generateVAPIDKeys()
  VAPID_PUBLIC_KEY = keys.publicKey
  VAPID_PRIVATE_KEY = keys.privateKey
  console.warn(
    '[push] ⚠ VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY не заданы — сгенерированы на лету.\n' +
      '        Для продакшена задайте их в env, иначе после рестарта подписки сломаются.',
  )
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

/** Публичный ключ отдаётся клиенту через `/api/push/vapid-public`. */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY
}

// --- In-memory fallback: userId → PushSubscription[] ---
const subscriptions = new Map()

// --- Ключи Redis ---
const K_USER = (uid) => `push:user:${uid}`
const K_SUB = (uid, fp) => `push:sub:${uid}:${fp}`

/** Отпечаток endpoint'а — чтобы не хранить URL в ключе. */
function fingerprint(endpoint) {
  return createHash('sha1').update(String(endpoint)).digest('hex').slice(0, 16)
}

function serializeSub(sub) {
  return {
    endpoint: sub.endpoint,
    p256dh: sub.keys?.p256dh || '',
    auth: sub.keys?.auth || '',
    expirationTime: sub.expirationTime == null ? '' : String(sub.expirationTime),
  }
}

function deserializeSub(h) {
  if (!h || !h.endpoint) return null
  return {
    endpoint: h.endpoint,
    expirationTime: h.expirationTime ? Number(h.expirationTime) : null,
    keys: { p256dh: h.p256dh, auth: h.auth },
  }
}

/** Добавить подписку (идемпотентно по endpoint). */
export async function addSubscription(userId, subscription) {
  if (!userId || !subscription?.endpoint) return

  const r = getRedis()
  if (r) {
    try {
      const fp = fingerprint(subscription.endpoint)
      const pipe = r.pipeline()
      pipe.sadd(K_USER(userId), subscription.endpoint)
      pipe.hset(K_SUB(userId, fp), serializeSub(subscription))
      await pipe.exec()
      return
    } catch (e) {
      console.warn('[push] addSubscription redis error, fallback:', e?.message || e)
    }
  }

  const list = subscriptions.get(userId) ?? []
  if (list.some((s) => s.endpoint === subscription.endpoint)) return
  list.push(subscription)
  subscriptions.set(userId, list)
}

/** Удалить подписку по endpoint. */
export async function removeSubscription(userId, endpoint) {
  if (!userId || !endpoint) return

  const r = getRedis()
  if (r) {
    try {
      const fp = fingerprint(endpoint)
      const pipe = r.pipeline()
      pipe.srem(K_USER(userId), endpoint)
      pipe.del(K_SUB(userId, fp))
      await pipe.exec()
      return
    } catch (e) {
      console.warn('[push] removeSubscription redis error, fallback:', e?.message || e)
    }
  }

  const list = subscriptions.get(userId)
  if (!list) return
  const next = list.filter((s) => s.endpoint !== endpoint)
  if (next.length) subscriptions.set(userId, next)
  else subscriptions.delete(userId)
}

/** Получить все подписки пользователя. */
export async function getSubscriptions(userId) {
  const r = getRedis()
  if (r) {
    try {
      const endpoints = await r.smembers(K_USER(userId))
      if (!endpoints.length) return []
      const pipe = r.pipeline()
      for (const ep of endpoints) pipe.hgetall(K_SUB(userId, fingerprint(ep)))
      const results = await pipe.exec()
      const out = []
      for (const [, h] of results) {
        const s = deserializeSub(h)
        if (s) out.push(s)
      }
      return out
    } catch (e) {
      console.warn('[push] getSubscriptions redis error, fallback:', e?.message || e)
    }
  }
  return subscriptions.get(userId) ?? []
}

/**
 * Отправить payload всем подпискам пользователя.
 * Удаляет подписки, на которые провайдер ответил 404/410 (подписка мертва).
 */
export async function notifyUser(userId, payload) {
  const list = await getSubscriptions(userId)
  if (!list || list.length === 0) return { sent: 0, removed: 0 }

  const json = JSON.stringify(payload)
  let sent = 0
  let removed = 0
  const toRemove = []

  await Promise.all(
    list.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, json)
        sent++
      } catch (err) {
        const code = err?.statusCode
        if (code === 404 || code === 410) {
          toRemove.push(sub.endpoint)
        } else {
          console.error('[push] sendNotification error:', code, err?.body || err?.message)
        }
      }
    }),
  )

  if (toRemove.length) {
    for (const ep of toRemove) {
      await removeSubscription(userId, ep)
    }
    removed = toRemove.length
  }

  return { sent, removed }
}
