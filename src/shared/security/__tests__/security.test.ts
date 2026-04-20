/**
 * Юнит-тесты модулей защиты: crypto, actions, pow, rate-limiter.
 * Используют define-значения из `vitest.config.ts`.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { sha256, hmacSha256, generateNonce } from '@/shared/security/crypto'
import { solveChallenge, verifyChallengeSolution } from '@/shared/security/pow'
import { resolveRoute, getRoutes } from '@/shared/security/actions'
import { ClientRateLimiter } from '@/shared/security/rate-limiter'

// jsdom 25 не предоставляет crypto.subtle — подтягиваем Node-ный WebCrypto.
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto as unknown as Crypto, configurable: true })
}

describe('crypto', () => {
  it('sha256 возвращает hex нужной длины', async () => {
    const hash = await sha256('abc')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('hmacSha256 детерминирован', async () => {
    const a = await hmacSha256('msg', 'key')
    const b = await hmacSha256('msg', 'key')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generateNonce возвращает уникальные строки', () => {
    const set = new Set<string>()
    for (let i = 0; i < 100; i++) set.add(generateNonce())
    expect(set.size).toBe(100)
  })
})

describe('pow', () => {
  it('solveChallenge находит корректный nonce', async () => {
    const nonce = await solveChallenge('test', 2)
    const ok = await verifyChallengeSolution('test', nonce, 2)
    expect(ok).toBe(true)
  })

  it('verifyChallengeSolution отвергает неверный nonce', async () => {
    const ok = await verifyChallengeSolution('test', '999999', 3)
    expect(ok).toBe(false)
  })
})

describe('actions.resolveRoute', () => {
  it('содержит зарегистрированные тестовые маршруты', () => {
    expect(getRoutes().length).toBeGreaterThan(0)
  })

  it('сопоставляет статический путь', () => {
    const r = resolveRoute('GET', '/api/pshop/items')
    expect(r).not.toBeNull()
    expect(r?.pathParams).toEqual({})
    expect(r?.search).toBe(true)
    expect(r?.actionId).toMatch(/^[A-Za-z0-9_-]{8}$/)
  })

  it('извлекает path-параметры', () => {
    const r = resolveRoute('GET', '/api/pshop/items/42/price-history')
    expect(r).not.toBeNull()
    expect(r?.pathParams.itemId).toBe('42')
    expect(r?.search).toBe(false)
  })

  it('учитывает HTTP-метод', () => {
    const get = resolveRoute('GET', '/api/players/properties/by-ids')
    const post = resolveRoute('POST', '/api/players/properties/by-ids')
    expect(get).toBeNull()
    expect(post).not.toBeNull()
  })

  it('возвращает null для незарегистрированного пути', () => {
    expect(resolveRoute('GET', '/api/nonexistent')).toBeNull()
  })
})

describe('ClientRateLimiter', () => {
  let limiter: ClientRateLimiter
  beforeEach(() => {
    limiter = new ClientRateLimiter({ maxRequests: 3, windowMs: 60_000, initialBackoffMs: 100, maxBackoffMs: 1000, backoffMultiplier: 2 })
  })

  it('разрешает до maxRequests', () => {
    for (let i = 0; i < 3; i++) {
      expect(limiter.canRequest()).toBe(true)
      limiter.recordRequest()
    }
    expect(limiter.canRequest()).toBe(false)
  })

  it('экспоненциальный backoff при 429', () => {
    limiter.handleTooManyRequests()
    expect(limiter.canRequest()).toBe(false)
    const first = limiter.getWaitTime()
    limiter.handleTooManyRequests()
    const second = limiter.getWaitTime()
    expect(second).toBeGreaterThan(first)
  })

  it('handleSuccess сбрасывает backoff', () => {
    limiter.handleTooManyRequests()
    limiter.handleSuccess()
    // ограничение окна ещё может быть, но backoff сброшен
    expect(limiter.getWaitTime()).toBe(0)
  })
})
