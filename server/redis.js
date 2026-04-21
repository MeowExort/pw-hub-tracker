/**
 * Обёртка над ioredis для BFF.
 *
 * Задачи:
 *  • единый клиент на процесс с префиксом ключей `pwhub:tracker:`;
 *  • graceful degradation: если Redis недоступен — модуль продолжает работать,
 *    а модули-хранилища (alerts/share/push) откатываются на in-memory fallback;
 *  • события подключения/ошибок логируются, но не валят процесс.
 *
 * Конфигурация через env:
 *  REDIS_URL       — например `redis://:password@host:6379/0`.
 *                    Если не задана, используется REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_DB.
 *  REDIS_HOST      — default `127.0.0.1`
 *  REDIS_PORT      — default 6379
 *  REDIS_PASSWORD  — optional
 *  REDIS_DB        — default 0
 *  REDIS_KEY_PREFIX — default `pwhub:tracker:`
 *  REDIS_DISABLED  — `1`/`true` — полностью отключить Redis (всегда работать на памяти).
 */

import Redis from 'ioredis'

const PREFIX = process.env.REDIS_KEY_PREFIX || 'pwhub:tracker:'
const DISABLED = /^(1|true|yes)$/i.test(String(process.env.REDIS_DISABLED || ''))

/** @type {import('ioredis').Redis | null} */
let client = null
let ready = false
let lastError = null

function buildClient() {
  const url = process.env.REDIS_URL
  const common = {
    keyPrefix: PREFIX,
    lazyConnect: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    // Экспоненциальная ретрай-стратегия с потолком 10с.
    retryStrategy: (times) => Math.min(1000 * 2 ** Math.min(times, 4), 10_000),
    reconnectOnError: () => true,
  }
  if (url) return new Redis(url, common)
  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    ...common,
  })
}

if (DISABLED) {
  console.warn('[redis] отключён через REDIS_DISABLED — используется in-memory fallback')
} else {
  try {
    client = buildClient()
    client.on('connect', () => {
      console.log(`[redis] connect (prefix=${PREFIX})`)
    })
    client.on('ready', () => {
      ready = true
      lastError = null
      console.log('[redis] ready')
    })
    client.on('error', (err) => {
      lastError = err
      // Не спамим в лог, логируем только смену состояния.
      if (ready) {
        ready = false
        console.warn('[redis] ошибка соединения, переходим на in-memory fallback:', err?.message || err)
      }
    })
    client.on('end', () => {
      ready = false
      console.warn('[redis] соединение закрыто')
    })
  } catch (e) {
    console.warn('[redis] не удалось инициализировать клиент:', e?.message || e)
    client = null
  }
}

/** Готов ли Redis принимать команды. */
export function isRedisReady() {
  return !!(client && ready)
}

/** Получить клиент, если он готов, иначе null. Удобно для `if (r = getRedis()) await r.xxx`. */
export function getRedis() {
  return isRedisReady() ? client : null
}

export function redisKey(...parts) {
  // keyPrefix добавляется самим ioredis, здесь возвращаем «логическую» часть.
  return parts.join(':')
}

/** Для тестов/диагностики. */
export function _redisDebug() {
  return { prefix: PREFIX, ready, disabled: DISABLED, lastError: lastError?.message || null }
}

/** Закрыть соединение (например, при graceful shutdown). */
export async function closeRedis() {
  if (!client) return
  try {
    await client.quit()
  } catch {
    client.disconnect()
  }
}
