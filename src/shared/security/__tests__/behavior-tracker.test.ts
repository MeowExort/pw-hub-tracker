/**
 * Unit-тесты для `behavior-tracker`. Среда jsdom (включена глобально).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  initBehaviorTracker,
  notifyTextInput,
  getBehaviorSnapshot,
  getBehaviorHeader,
  __resetBehaviorTrackerForTests,
} from '../behavior-tracker'

function decodeHeader(header: string): Record<string, unknown> {
  const b64 = header.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const json = atob(b64 + pad)
  return JSON.parse(json)
}

beforeEach(() => {
  __resetBehaviorTrackerForTests()
})

describe('behavior-tracker', () => {
  it('до init — возвращает «пустой» snapshot', () => {
    const snap = getBehaviorSnapshot()
    expect(snap.mouseMoves).toBe(0)
    expect(snap.keyDowns).toBe(0)
    expect(snap.typingPattern).toBe('none')
    expect(snap.lastInteractionAgoMs).toBe(-1)
  })

  it('регистрирует keydown и mousemove через window-события', () => {
    initBehaviorTracker()

    window.dispatchEvent(new Event('mousemove'))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))

    const snap = getBehaviorSnapshot()
    expect(snap.mouseMoves).toBe(1)
    expect(snap.keyDowns).toBe(2)
    expect(snap.typingPattern).toBe('human')
    expect(snap.lastInteractionAgoMs).toBeGreaterThanOrEqual(0)
  })

  it('notifyTextInput: большая вставка → typingPattern = "paste"', () => {
    initBehaviorTracker()
    notifyTextInput(0, 20) // 20 символов за одно событие → paste
    const snap = getBehaviorSnapshot()
    expect(snap.typingPattern).toBe('paste')
  })

  it('notifyTextInput: посимвольный ввод → "human"', () => {
    initBehaviorTracker()
    notifyTextInput(0, 1)
    notifyTextInput(1, 2)
    notifyTextInput(2, 3)
    const snap = getBehaviorSnapshot()
    expect(snap.typingPattern).toBe('human')
  })

  it('getBehaviorHeader возвращает декодируемый base64url JSON с ожидаемыми ключами', () => {
    initBehaviorTracker()
    window.dispatchEvent(new KeyboardEvent('keydown'))
    const header = getBehaviorHeader()
    expect(typeof header).toBe('string')
    expect(header.length).toBeGreaterThan(0)
    expect(header.length).toBeLessThan(200) // требование ТЗ
    const decoded = decodeHeader(header)
    expect(decoded).toHaveProperty('mm')
    expect(decoded).toHaveProperty('kd')
    expect(decoded).toHaveProperty('sc')
    expect(decoded).toHaveProperty('tc')
    expect(decoded).toHaveProperty('fc')
    expect(decoded).toHaveProperty('la')
    expect(decoded).toHaveProperty('sa')
    expect(decoded).toHaveProperty('tp')
  })

  it('повторный init — идемпотентен (не дублирует слушатели)', () => {
    initBehaviorTracker()
    initBehaviorTracker()
    window.dispatchEvent(new KeyboardEvent('keydown'))
    const snap = getBehaviorSnapshot()
    expect(snap.keyDowns).toBe(1)
  })

  it('scroll и touchstart учитываются', () => {
    initBehaviorTracker()
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('touchstart'))
    const snap = getBehaviorSnapshot()
    expect(snap.scrolls).toBe(1)
    expect(snap.touches).toBe(1)
  })
})
