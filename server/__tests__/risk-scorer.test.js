/**
 * Юнит-тесты для `server/risk-scorer.js`.
 * Запускаются через общий vitest проекта (environment jsdom нам не мешает).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  scoreRisk,
  parseBehaviorHeader,
  markWarmupVisit,
  hasWarmupVisit,
  isFreshFingerprint,
  recordRequestForEntropy,
  getEntropyStats,
  isBanned,
  addBan,
  clearBanForTests,
  __internals,
} from '../risk-scorer.js'

/** Собирает base64url-кодированный header, как это делает клиент. */
function makeBehavior(obj) {
  const json = JSON.stringify(obj)
  return Buffer.from(json, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** "Человеческий" snapshot: есть мышь, клавиши, скролл, сессия старая. */
function humanBehavior() {
  return makeBehavior({
    mm: 50,
    kd: 10,
    sc: 5,
    tc: 0,
    fc: 1,
    la: 100,
    sa: 60_000,
    tp: 'human',
  })
}

beforeEach(() => {
  clearBanForTests()
  __internals.warmupFp.clear()
  __internals.knownFp.clear()
  __internals.entropyByFp.clear()
})

describe('parseBehaviorHeader', () => {
  it('парсит валидный base64url(JSON)', () => {
    const h = makeBehavior({ mm: 1, kd: 2 })
    const r = parseBehaviorHeader(h)
    expect(r.valid).toBe(true)
    expect(r.snapshot).toEqual({ mm: 1, kd: 2 })
  })

  it('возвращает invalid для пустой/битой строки', () => {
    expect(parseBehaviorHeader('').valid).toBe(false)
    expect(parseBehaviorHeader('!!!not-base64!!!').valid).toBe(false)
    expect(parseBehaviorHeader(undefined).valid).toBe(false)
  })
})

describe('scoreRisk: сценарии', () => {
  it('1) «Человек с прогревом» — score < 40', () => {
    const { score } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'fp-human',
      behaviorHeader: humanBehavior(),
      limitState: { ipRatio: 0.1, fpRatio: 0.1, searchRatio: 0.1 },
      entropy: { uniqueRatio: 0.9, sampleSize: 20 },
      session: { isFreshFp: false, hasSessionToken: true, hasWarmupVisit: true },
    })
    expect(score).toBeLessThan(40)
  })

  it('2) Нет X-Behavior + нет warmup + свежий fp — score ≥ 40', () => {
    const { score, reasons } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'fp-cold',
      behaviorHeader: '',
      limitState: { ipRatio: 0.2, fpRatio: 0.2, searchRatio: 0.0 },
      entropy: { uniqueRatio: 1, sampleSize: 0 },
      session: { isFreshFp: true, hasSessionToken: false, hasWarmupVisit: false },
    })
    // 25 (behaviorMissing) + 15 (noSession) + 15 (freshFp) = 55
    expect(score).toBeGreaterThanOrEqual(40)
    expect(reasons.some((r) => r.includes('behaviorMissing'))).toBe(true)
    expect(reasons.some((r) => r.includes('noWarmupVisit'))).toBe(true)
  })

  it('3) Монотонный парсер (низкая энтропия + datacenter ASN) — score ≥ 70', () => {
    const { score } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'fp-scraper',
      behaviorHeader: makeBehavior({ mm: 0, kd: 0, sc: 0, tc: 0, fc: 0, sa: 30_000, tp: 'none' }),
      limitState: { ipRatio: 0.9, fpRatio: 0.9, searchRatio: 0.9 },
      entropy: { uniqueRatio: 0.05, sampleSize: 40 },
      session: { isFreshFp: true, hasSessionToken: false, hasWarmupVisit: false },
      asn: { isDatacenter: true },
    })
    expect(score).toBeGreaterThanOrEqual(70)
  })

  it('4) Тяжёлый бот (все сигналы) — score ≥ 90', () => {
    const { score } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'fp-bot',
      behaviorHeader: '', // missing → 25
      limitState: { ipRatio: 1.0, fpRatio: 1.0, searchRatio: 1.0 }, // ~30
      entropy: { uniqueRatio: 0.05, sampleSize: 40 }, // 20
      session: { isFreshFp: true, hasSessionToken: false, hasWarmupVisit: false }, // 15 + 15
      asn: { isDatacenter: true }, // 30
    })
    expect(score).toBeGreaterThanOrEqual(90)
  })

  it('5) Paste без движений мыши — даёт штраф', () => {
    const { score, reasons } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'fp-paste',
      behaviorHeader: makeBehavior({ mm: 0, kd: 20, sc: 0, tc: 0, fc: 0, sa: 5_000, tp: 'paste' }),
      limitState: { ipRatio: 0.1, fpRatio: 0.1, searchRatio: 0.1 },
      entropy: { uniqueRatio: 1, sampleSize: 5 },
      session: { isFreshFp: false, hasSessionToken: true, hasWarmupVisit: true },
    })
    expect(reasons.some((r) => r.includes('pasteNoMouse'))).toBe(true)
    expect(score).toBeGreaterThan(0)
  })

  it('6) Score ограничен диапазоном 0..100', () => {
    const { score } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'x',
      behaviorHeader: '',
      limitState: { ipRatio: 1, fpRatio: 1, searchRatio: 1 },
      entropy: { uniqueRatio: 0, sampleSize: 50 },
      session: { isFreshFp: true, hasSessionToken: false, hasWarmupVisit: false },
      asn: { isDatacenter: true },
    })
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('7) Веса переопределяются через параметр', () => {
    const { score } = scoreRisk(
      {
        ip: '1.2.3.4',
        fp: 'x',
        behaviorHeader: '',
        limitState: { ipRatio: 0, fpRatio: 0, searchRatio: 0 },
      },
      {
        rateLimitRatio: 0,
        behaviorMissing: 5,
        behaviorBot: 0,
        lowEntropy: 0,
        noSession: 0,
        datacenterAsn: 0,
        freshFp: 0,
      },
    )
    expect(score).toBe(5)
  })
})

describe('warmup / fresh fp / entropy / ban stores', () => {
  it('markWarmupVisit → hasWarmupVisit=true', () => {
    expect(hasWarmupVisit('fp-a')).toBe(false)
    markWarmupVisit('fp-a')
    expect(hasWarmupVisit('fp-a')).toBe(true)
  })

  it('isFreshFingerprint: первый раз true, второй — false', () => {
    expect(isFreshFingerprint('fp-new')).toBe(true)
    expect(isFreshFingerprint('fp-new')).toBe(false)
  })

  it('entropy: uniqueRatio считается правильно', () => {
    for (let i = 0; i < 10; i++) {
      recordRequestForEntropy('fp-e', 'actA', 'same')
    }
    const s1 = getEntropyStats('fp-e')
    expect(s1.sampleSize).toBe(10)
    expect(s1.uniqueRatio).toBe(0.1) // 1 уникальный / 10

    for (let i = 0; i < 10; i++) {
      recordRequestForEntropy('fp-e2', 'actA', `p${i}`)
    }
    const s2 = getEntropyStats('fp-e2')
    expect(s2.uniqueRatio).toBe(1)
  })

  it('entropy: intervalCv и market/non-market счётчики', () => {
    // Имитируем 10 записей с близко идущими ts (все сейчас) — интервалы 0, CV=0 или null.
    const now = Date.now()
    // Искусственно зададим записи напрямую через внутренний Map чтобы контролировать ts.
    const buf = []
    for (let i = 0; i < 10; i++) {
      buf.push({ action: 'a', params: `p${i % 2}`, ts: now - (10 - i) * 1000, isMarket: true })
    }
    __internals.entropyByFp.set('fp-cv', buf)
    const s = getEntropyStats('fp-cv')
    expect(s.sampleSize).toBe(10)
    // Интервалы все ~1000 мс → CV ≈ 0 (меньше 0.1)
    expect(s.intervalCv).not.toBeNull()
    expect(s.intervalCv).toBeLessThan(0.1)
    expect(s.marketCount).toBe(10)
    expect(s.nonMarketCount).toBe(0)
  })

  it('scoreRisk: lowIntervalCv даёт +20 при sampleSize≥10', () => {
    const { score, reasons } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'x',
      behaviorHeader: humanBehavior(),
      limitState: { ipRatio: 0, fpRatio: 0, searchRatio: 0 },
      entropy: { uniqueRatio: 1, sampleSize: 20, intervalCv: 0.01, marketCount: 0, nonMarketCount: 0 },
      session: { isFreshFp: false, hasSessionToken: true, hasWarmupVisit: true },
    })
    expect(reasons.some((r) => r.includes('lowIntervalCv'))).toBe(true)
    expect(score).toBeGreaterThanOrEqual(20)
  })

  it('scoreRisk: onlyMarket даёт +10 при >30 market и 0 non-market', () => {
    const { score, reasons } = scoreRisk({
      ip: '1.2.3.4',
      fp: 'x',
      behaviorHeader: humanBehavior(),
      limitState: { ipRatio: 0, fpRatio: 0, searchRatio: 0 },
      entropy: { uniqueRatio: 1, sampleSize: 40, marketCount: 35, nonMarketCount: 0 },
      session: { isFreshFp: false, hasSessionToken: true, hasWarmupVisit: true },
    })
    expect(reasons.some((r) => r.includes('onlyMarket'))).toBe(true)
    expect(score).toBeGreaterThanOrEqual(10)
  })

  it('scoreRisk: скрипт «каждые 2с одинаковый запрос 60 раз» → score > 70 к 20-й итерации', () => {
    // Критерий приёмки задачи 7.
    const fp = 'fp-monotonic'
    const baseTs = Date.now() - 10_000
    const buf = []
    for (let i = 0; i < 20; i++) {
      buf.push({ action: 'getItems', params: 'same', ts: baseTs + i * 2000, isMarket: true })
    }
    __internals.entropyByFp.set(fp, buf)
    const stats = getEntropyStats(fp)
    const { score } = scoreRisk({
      ip: '1.2.3.4',
      fp,
      behaviorHeader: '', // монотонный бот без поведения
      limitState: { ipRatio: 0.5, fpRatio: 0.5, searchRatio: 0.5 },
      entropy: stats,
      session: { isFreshFp: true, hasSessionToken: false, hasWarmupVisit: false },
    })
    expect(score).toBeGreaterThan(70)
  })

  it('ban: isBanned=true после addBan, и самоочищается по TTL', () => {
    expect(isBanned('1.1.1.1', 'fpx')).toBe(false)
    addBan('1.1.1.1', 'fpx', 50)
    expect(isBanned('1.1.1.1', 'fpx')).toBe(true)
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(isBanned('1.1.1.1', 'fpx')).toBe(false)
        resolve()
      }, 80)
    })
  })
})
