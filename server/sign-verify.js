/**
 * Проверка HMAC-подписи запросов через `POST /api/proxy`.
 *
 * Отдельный модуль ради тестируемости: чистые функции + изолированный
 * nonce-кэш, без обвеса express/redis из `index.js`.
 *
 * Формат входа подписи (должен совпадать с `src/shared/security/signing.ts`):
 *   `${action}:${payload}:${timestamp}:${nonce}:${fingerprint}`
 *
 * Замена `boolean` на объект с кодом причины введена ради диагностики на
 * проде: «Неверная подпись» раньше маскировала четыре разных провала.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const MAX_NONCES = 10_000
const NONCE_TTL_MS = 2 * 60_000

/**
 * Создаёт изолированный верификатор с собственным кэшем nonce.
 * Возвращает объект с методом `verify(body, fingerprint)`.
 */
export function createSignatureVerifier({
  signingSecret,
  windowMs = 30_000,
  now = () => Date.now(),
} = {}) {
  const usedNonces = new Map()

  function purgeExpiredNonces(currentNow) {
    const cutoff = currentNow - NONCE_TTL_MS
    for (const [n, t] of usedNonces) {
      if (t < cutoff) usedNonces.delete(n)
    }
  }

  function verify(body, fingerprint) {
    if (!signingSecret) return { ok: true } // секрет не задан — проверка отключена
    const { action, payload, timestamp, nonce, signature } = body || {}
    if (!action || typeof payload !== 'string' || !timestamp || !nonce || !signature) {
      return { ok: false, reason: 'SIG_MISSING_FIELDS' }
    }

    const currentNow = now()
    const skew = currentNow - Number(timestamp)
    if (Math.abs(skew) > windowMs) {
      return { ok: false, reason: 'SIG_BAD_TIMESTAMP', serverTime: currentNow, skew }
    }

    if (usedNonces.has(nonce)) return { ok: false, reason: 'SIG_REPLAY' }

    const input = `${action}:${payload}:${timestamp}:${nonce}:${fingerprint || ''}`
    const expected = createHmac('sha256', signingSecret).update(input).digest('hex')

    let sigBuf, expBuf
    try {
      sigBuf = Buffer.from(String(signature), 'hex')
      expBuf = Buffer.from(expected, 'hex')
    } catch {
      return { ok: false, reason: 'SIG_BAD_HMAC' }
    }
    if (sigBuf.length !== expBuf.length) return { ok: false, reason: 'SIG_BAD_HMAC' }
    if (!timingSafeEqual(sigBuf, expBuf)) return { ok: false, reason: 'SIG_BAD_HMAC' }

    usedNonces.set(nonce, currentNow)
    if (usedNonces.size > MAX_NONCES) {
      const firstKey = usedNonces.keys().next().value
      usedNonces.delete(firstKey)
    }
    return { ok: true }
  }

  return { verify, purgeExpiredNonces, _usedNonces: usedNonces }
}
