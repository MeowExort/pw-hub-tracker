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

/**
 * Выполнить smoke-проверку доступности Redis: ожидание готовности клиента,
 * PING, и цикл SET/GET/DEL тестового ключа. Не бросает исключений —
 * возвращает структурированный результат для логирования при старте.
 *
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{
 *   ok: boolean,
 *   disabled: boolean,
 *   ready: boolean,
 *   latencyMs?: number,
 *   ping?: string,
 *   error?: string,
 *   step?: 'wait'|'ping'|'set'|'get'|'verify'|'del',
 * }>}
 */
export async function checkRedis(opts = {}) {
  const timeoutMs = Number(opts.timeoutMs ?? 3000)
  if (DISABLED) {
    return { ok: false, disabled: true, ready: false, error: 'REDIS_DISABLED' }
  }
  if (!client) {
    return { ok: false, disabled: false, ready: false, error: 'client_not_initialized' }
  }
  const started = Date.now()
  try {
    if (!ready) {
      await new Promise((resolve, reject) => {
        const onReady = () => {
          client.off('ready', onReady)
          client.off('error', onError)
          clearTimeout(t)
          resolve()
        }
        const onError = (err) => {
          client.off('ready', onReady)
          client.off('error', onError)
          clearTimeout(t)
          reject(err)
        }
        const t = setTimeout(() => {
          client.off('ready', onReady)
          client.off('error', onError)
          reject(new Error(`timeout ${timeoutMs}ms waiting for ready`))
        }, timeoutMs)
        client.once('ready', onReady)
        client.once('error', onError)
      })
    }

    const pong = await client.ping()
    const key = `healthcheck:${process.pid}:${Date.now()}`
    const value = `ok-${Math.random().toString(36).slice(2, 10)}`

    const setRes = await client.set(key, value, 'EX', 10)
    if (setRes !== 'OK') {
      return { ok: false, disabled: false, ready: true, step: 'set', error: `SET returned ${setRes}` }
    }
    const got = await client.get(key)
    if (got !== value) {
      // Подстрахуемся: удалим ключ перед возвратом.
      try { await client.del(key) } catch {}
      return {
        ok: false,
        disabled: false,
        ready: true,
        step: 'verify',
        error: `GET mismatch: expected ${value}, got ${got}`,
      }
    }
    const delRes = await client.del(key)
    if (delRes !== 1) {
      return { ok: false, disabled: false, ready: true, step: 'del', error: `DEL returned ${delRes}` }
    }
    return {
      ok: true,
      disabled: false,
      ready: true,
      ping: pong,
      latencyMs: Date.now() - started,
    }
  } catch (e) {
    return {
      ok: false,
      disabled: false,
      ready,
      error: e?.message || String(e),
    }
  }
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
