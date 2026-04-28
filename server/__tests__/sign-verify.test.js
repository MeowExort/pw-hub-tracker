import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { createSignatureVerifier } from '../sign-verify.js'

const SECRET = 'test-secret-fixed'
const FP = 'fp-abc123'

function buildSignedBody({
  action = 'a1',
  payload = '{"k":"v"}',
  timestamp,
  nonce = 'nonce-' + Math.random().toString(16).slice(2),
  fingerprint = FP,
  secret = SECRET,
} = {}) {
  const ts = timestamp ?? Date.now()
  const input = `${action}:${payload}:${ts}:${nonce}:${fingerprint}`
  const signature = createHmac('sha256', secret).update(input).digest('hex')
  return { action, payload, timestamp: ts, nonce, signature }
}

describe('sign-verify', () => {
  it('валидный запрос — ok: true', () => {
    const v = createSignatureVerifier({ signingSecret: SECRET })
    const body = buildSignedBody()
    expect(v.verify(body, FP)).toEqual({ ok: true })
  })

  it('пустой signingSecret — режим выключен, всегда ok', () => {
    const v = createSignatureVerifier({ signingSecret: '' })
    expect(v.verify({}, '')).toEqual({ ok: true })
  })

  it('SIG_MISSING_FIELDS — нет signature', () => {
    const v = createSignatureVerifier({ signingSecret: SECRET })
    const body = buildSignedBody()
    delete body.signature
    expect(v.verify(body, FP)).toEqual({ ok: false, reason: 'SIG_MISSING_FIELDS' })
  })

  it('SIG_MISSING_FIELDS — payload не строка', () => {
    const v = createSignatureVerifier({ signingSecret: SECRET })
    const body = buildSignedBody()
    body.payload = { k: 'v' } // должен быть JSON-строкой
    const res = v.verify(body, FP)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('SIG_MISSING_FIELDS')
  })

  it('SIG_BAD_TIMESTAMP — клиентское время отстаёт > 30 сек', () => {
    const fixedNow = 2_000_000_000_000
    const v = createSignatureVerifier({ signingSecret: SECRET, now: () => fixedNow })
    const body = buildSignedBody({ timestamp: fixedNow - 60_000 })
    const res = v.verify(body, FP)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('SIG_BAD_TIMESTAMP')
    expect(res.serverTime).toBe(fixedNow)
    expect(res.skew).toBe(60_000)
  })

  it('SIG_BAD_TIMESTAMP — клиентское время впереди > 30 сек', () => {
    const fixedNow = 2_000_000_000_000
    const v = createSignatureVerifier({ signingSecret: SECRET, now: () => fixedNow })
    const body = buildSignedBody({ timestamp: fixedNow + 45_000 })
    const res = v.verify(body, FP)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('SIG_BAD_TIMESTAMP')
    expect(res.skew).toBe(-45_000)
  })

  it('окно ±30 сек: timestamp ровно на границе проходит', () => {
    const fixedNow = 2_000_000_000_000
    const v = createSignatureVerifier({ signingSecret: SECRET, now: () => fixedNow })
    const body = buildSignedBody({ timestamp: fixedNow - 30_000 })
    expect(v.verify(body, FP).ok).toBe(true)
  })

  it('SIG_REPLAY — повторное использование nonce', () => {
    const v = createSignatureVerifier({ signingSecret: SECRET })
    const body = buildSignedBody()
    expect(v.verify(body, FP).ok).toBe(true)
    const res = v.verify(body, FP)
    expect(res).toEqual({ ok: false, reason: 'SIG_REPLAY' })
  })

  it('SIG_BAD_HMAC — секрет не совпадает', () => {
    const v = createSignatureVerifier({ signingSecret: SECRET })
    const body = buildSignedBody({ secret: 'другой-секрет' })
    const res = v.verify(body, FP)
    expect(res).toEqual({ ok: false, reason: 'SIG_BAD_HMAC' })
  })

  it('SIG_BAD_HMAC — fingerprint не совпадает', () => {
    const v = createSignatureVerifier({ signingSecret: SECRET })
    const body = buildSignedBody({ fingerprint: 'другой-fp' })
    const res = v.verify(body, FP)
    expect(res).toEqual({ ok: false, reason: 'SIG_BAD_HMAC' })
  })

  it('SIG_BAD_HMAC — подпись не валидный hex', () => {
    const v = createSignatureVerifier({ signingSecret: SECRET })
    const body = buildSignedBody()
    body.signature = 'not-a-hex!'
    const res = v.verify(body, FP)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('SIG_BAD_HMAC')
  })

  it('purgeExpiredNonces удаляет старые записи', () => {
    let now = 1_000_000_000_000
    const v = createSignatureVerifier({ signingSecret: SECRET, now: () => now })
    const body1 = buildSignedBody({ timestamp: now })
    expect(v.verify(body1, FP).ok).toBe(true)
    expect(v._usedNonces.size).toBe(1)

    // Прошло > 2 минут — старый nonce должен быть очищен.
    now += 3 * 60_000
    v.purgeExpiredNonces(now)
    expect(v._usedNonces.size).toBe(0)
  })
})
