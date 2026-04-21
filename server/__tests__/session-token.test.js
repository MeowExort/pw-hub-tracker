import { describe, it, expect, beforeEach } from 'vitest'
import {
  issueSessionToken,
  verifySessionToken,
  sessionKeys,
  SESSION_TTL_MS,
} from '../session-token.js'

beforeEach(() => {
  sessionKeys._reset('test-secret-fixed')
})

describe('session-token', () => {
  it('issue + verify: валидный токен проходит', () => {
    const { token, exp } = issueSessionToken('1.2.3.4', 'fp-abc')
    expect(typeof token).toBe('string')
    expect(token.includes('.')).toBe(true)
    expect(exp).toBeGreaterThan(Date.now())

    const check = verifySessionToken(token, '1.2.3.4', 'fp-abc')
    expect(check.valid).toBe(true)
    expect(check.exp).toBe(exp)
  })

  it('отвергает при несовпадении ip', () => {
    const { token } = issueSessionToken('1.2.3.4', 'fp-abc')
    const check = verifySessionToken(token, '5.6.7.8', 'fp-abc')
    expect(check.valid).toBe(false)
    expect(check.reason).toBe('ip')
  })

  it('отвергает при несовпадении fp', () => {
    const { token } = issueSessionToken('1.2.3.4', 'fp-abc')
    const check = verifySessionToken(token, '1.2.3.4', 'fp-other')
    expect(check.valid).toBe(false)
    expect(check.reason).toBe('fp')
  })

  it('отвергает просроченный токен', () => {
    const now = Date.now()
    const { token, exp } = issueSessionToken('1.2.3.4', 'fp-abc', now)
    const check = verifySessionToken(token, '1.2.3.4', 'fp-abc', exp + 1)
    expect(check.valid).toBe(false)
    expect(check.reason).toBe('expired')
  })

  it('отвергает изменённую подпись', () => {
    const { token } = issueSessionToken('1.2.3.4', 'fp-abc')
    const [payload, sig] = token.split('.')
    const tampered = `${payload}.${sig.replace(/.$/, (c) => (c === '0' ? '1' : '0'))}`
    const check = verifySessionToken(tampered, '1.2.3.4', 'fp-abc')
    expect(check.valid).toBe(false)
    expect(check.reason).toBe('sig')
  })

  it('отвергает пустой / некорректный формат', () => {
    expect(verifySessionToken('', '1.2.3.4', 'fp').valid).toBe(false)
    expect(verifySessionToken('nodotshere', '1.2.3.4', 'fp').valid).toBe(false)
    expect(verifySessionToken('.', '1.2.3.4', 'fp').valid).toBe(false)
  })

  it('после ротации предыдущие токены остаются валидными (до ротации дважды)', () => {
    const { token } = issueSessionToken('1.2.3.4', 'fp-abc')
    sessionKeys.rotate()
    // Старый токен подписан предыдущим активным ключом (теперь previous) — должен пройти.
    const check = verifySessionToken(token, '1.2.3.4', 'fp-abc')
    expect(check.valid).toBe(true)

    // Вторая ротация вытесняет старый ключ — токен становится невалидным.
    sessionKeys.rotate()
    const check2 = verifySessionToken(token, '1.2.3.4', 'fp-abc')
    expect(check2.valid).toBe(false)
  })

  it('TTL ≈ 10 минут', () => {
    const now = Date.now()
    const { exp } = issueSessionToken('1.2.3.4', 'fp', now)
    expect(exp - now).toBe(SESSION_TTL_MS)
  })
})
