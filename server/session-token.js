/**
 * Signed session token (задача 5).
 *
 * Формат: `base64url(payload).signatureHex`, где
 *   payload   = `${ip}|${fp}|${iat}|${exp}|${kid}`
 *   signature = HMAC-SHA256(payload, secret[kid])
 *
 * `kid` = идентификатор активного ключа (0 или 1), позволяет бесшовно ротировать
 * секрет: активный ключ используется для подписи, оба — для проверки.
 *
 * TTL по умолчанию 10 минут. Токен привязывается к `ip` и `fp` клиента.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export const SESSION_TTL_MS = 10 * 60_000
/** Интервал ротации ключа (сутки). */
export const SESSION_KEY_ROTATION_MS = 24 * 60 * 60 * 1000

/**
 * Хранилище ключей с ротацией.
 * Активный ключ = keys[activeKid]; предыдущий = keys[1 - activeKid].
 */
function createKeyStore(initialSecret) {
  const seed = initialSecret || randomBytes(32).toString('hex')
  const keys = [seed, randomBytes(32).toString('hex')]
  let activeKid = 0
  let lastRotateAt = Date.now()

  return {
    getActive() {
      return { kid: activeKid, secret: keys[activeKid] }
    },
    getSecret(kid) {
      if (kid !== 0 && kid !== 1) return null
      return keys[kid] || null
    },
    rotate() {
      const next = 1 - activeKid
      keys[next] = randomBytes(32).toString('hex')
      activeKid = next
      lastRotateAt = Date.now()
    },
    maybeRotate(now = Date.now()) {
      if (now - lastRotateAt >= SESSION_KEY_ROTATION_MS) this.rotate()
    },
    /** только для тестов */
    _reset(secret) {
      keys[0] = secret || randomBytes(32).toString('hex')
      keys[1] = randomBytes(32).toString('hex')
      activeKid = 0
      lastRotateAt = Date.now()
    },
  }
}

export const sessionKeys = createKeyStore(process.env.SESSION_SECRET || '')

// Автоматическая ротация раз в сутки.
setInterval(() => sessionKeys.maybeRotate(), 60 * 60_000).unref?.()

function b64urlEncode(str) {
  return Buffer.from(str, 'utf-8').toString('base64url')
}

function b64urlDecode(str) {
  try {
    return Buffer.from(str, 'base64url').toString('utf-8')
  } catch {
    return null
  }
}

/**
 * Выдать токен сессии.
 * @param {string} ip
 * @param {string} fp
 * @param {number} [now]
 * @returns {{ token: string, exp: number }}
 */
export function issueSessionToken(ip, fp, now = Date.now()) {
  const { kid, secret } = sessionKeys.getActive()
  const iat = now
  const exp = now + SESSION_TTL_MS
  const payloadRaw = `${ip}|${fp || ''}|${iat}|${exp}|${kid}`
  const payload = b64urlEncode(payloadRaw)
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return { token: `${payload}.${signature}`, exp }
}

/**
 * Проверить токен сессии.
 *
 * @param {string} token
 * @param {string} ip
 * @param {string} fp
 * @param {number} [now]
 * @returns {{ valid: boolean, reason?: string, exp?: number }}
 */
export function verifySessionToken(token, ip, fp, now = Date.now()) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'empty' }
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return { valid: false, reason: 'format' }

  const payloadB64 = token.slice(0, dot)
  const signatureHex = token.slice(dot + 1)
  const raw = b64urlDecode(payloadB64)
  if (!raw) return { valid: false, reason: 'decode' }

  const parts = raw.split('|')
  if (parts.length !== 5) return { valid: false, reason: 'payload' }
  const [pIp, pFp, iatStr, expStr, kidStr] = parts
  const iat = Number(iatStr)
  const exp = Number(expStr)
  const kid = Number(kidStr)
  if (!Number.isFinite(iat) || !Number.isFinite(exp) || !Number.isFinite(kid)) {
    return { valid: false, reason: 'payload' }
  }

  const secret = sessionKeys.getSecret(kid)
  if (!secret) return { valid: false, reason: 'kid' }

  const expectedHex = createHmac('sha256', secret).update(payloadB64).digest('hex')
  let sigBuf, expBuf
  try {
    sigBuf = Buffer.from(signatureHex, 'hex')
    expBuf = Buffer.from(expectedHex, 'hex')
  } catch {
    return { valid: false, reason: 'sig' }
  }
  if (sigBuf.length !== expBuf.length) return { valid: false, reason: 'sig' }
  if (!timingSafeEqual(sigBuf, expBuf)) return { valid: false, reason: 'sig' }

  if (now >= exp) return { valid: false, reason: 'expired' }
  if (pIp !== ip) return { valid: false, reason: 'ip' }
  if (pFp !== (fp || '')) return { valid: false, reason: 'fp' }

  return { valid: true, exp }
}
