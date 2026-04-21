/**
 * Юнит-тесты для `server/asn-lookup.js`.
 *
 * MaxMind-БД в тестах не предполагается, проверяется fallback по CIDR
 * и корректность оффлайн-режима (нет БД → не бросает).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { lookupAsn, __internals } from '../asn-lookup.js'

beforeEach(() => {
  __internals.clearLru()
})

describe('asn-lookup: IPv4 парсинг', () => {
  it('ipv4ToInt корректно парсит валидные адреса', () => {
    expect(__internals.ipv4ToInt('0.0.0.0')).toBe(0)
    expect(__internals.ipv4ToInt('255.255.255.255')).toBe(0xffffffff >>> 0)
    expect(__internals.ipv4ToInt('192.168.1.1')).toBe(((192 << 24) | (168 << 16) | (1 << 8) | 1) >>> 0)
  })

  it('ipv4ToInt возвращает null для невалидных', () => {
    expect(__internals.ipv4ToInt('not.an.ip.addr')).toBeNull()
    expect(__internals.ipv4ToInt('256.1.1.1')).toBeNull()
    expect(__internals.ipv4ToInt('')).toBeNull()
    expect(__internals.ipv4ToInt(null)).toBeNull()
  })

  it('ipv4ToInt поддерживает ::ffff:IPv4 (IPv4-mapped IPv6)', () => {
    expect(__internals.ipv4ToInt('::ffff:1.2.3.4')).toBe(((1 << 24) | (2 << 16) | (3 << 8) | 4) >>> 0)
  })

  it('parseCidr корректно разбирает маску', () => {
    expect(__internals.parseCidr('10.0.0.0/8')).toEqual({
      base: (10 << 24) >>> 0,
      mask: 0xff000000 >>> 0,
    })
    expect(__internals.parseCidr('10.0.0.0/33')).toBeNull()
    expect(__internals.parseCidr('bad')).toBeNull()
  })
})

describe('asn-lookup: lookupAsn', () => {
  it('IP из AWS CIDR → isDatacenter=true, source=cidr', () => {
    // 3.5.0.1 принадлежит 3.0.0.0/9
    const r = lookupAsn('3.5.0.1')
    expect(r.isDatacenter).toBe(true)
    expect(r.source).toBe('cidr')
    expect(r.org).toBe('AWS')
  })

  it('IP из Hetzner CIDR → isDatacenter=true', () => {
    const r = lookupAsn('5.9.10.11') // 5.9.0.0/16
    expect(r.isDatacenter).toBe(true)
    expect(r.org).toBe('Hetzner')
  })

  it('обычный IP (не датацентр) → isDatacenter=false, source=none', () => {
    // 1.2.3.4 — неизвестен в seed-списке.
    const r = lookupAsn('1.2.3.4')
    expect(r.isDatacenter).toBe(false)
    expect(r.source).toBe('none')
  })

  it('невалидный IP не бросает, возвращает source=none', () => {
    expect(() => lookupAsn('not-an-ip')).not.toThrow()
    const r = lookupAsn('not-an-ip')
    expect(r.isDatacenter).toBe(false)
    expect(r.source).toBe('none')
  })

  it('пустая строка / null → source=none', () => {
    expect(lookupAsn('').source).toBe('none')
    expect(lookupAsn(null).source).toBe('none')
  })

  it('результат кэшируется в LRU', () => {
    expect(__internals.lru.size).toBe(0)
    lookupAsn('3.5.0.1')
    lookupAsn('3.5.0.1')
    expect(__internals.lru.has('3.5.0.1')).toBe(true)
    expect(__internals.lru.size).toBe(1)
  })

  it('::ffff:AWS-IP → корректный детект через CIDR', () => {
    const r = lookupAsn('::ffff:3.5.0.1')
    expect(r.isDatacenter).toBe(true)
    expect(r.org).toBe('AWS')
  })
})
