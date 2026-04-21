import { describe, it, expect } from 'vitest'
import {
  difficultyForScore,
  POW_MIN_DIFFICULTY,
  POW_MID_DIFFICULTY,
  POW_HARD_DIFFICULTY,
} from '../dynamic-pow.js'

describe('difficultyForScore', () => {
  it('возвращает минимальную сложность для score < 40', () => {
    expect(difficultyForScore(0)).toBe(POW_MIN_DIFFICULTY)
    expect(difficultyForScore(39)).toBe(POW_MIN_DIFFICULTY)
  })

  it('средняя сложность для 40..69', () => {
    expect(difficultyForScore(40)).toBe(POW_MID_DIFFICULTY)
    expect(difficultyForScore(55)).toBe(POW_MID_DIFFICULTY)
    expect(difficultyForScore(69)).toBe(POW_MID_DIFFICULTY)
  })

  it('высокая сложность для score ≥ 70', () => {
    expect(difficultyForScore(70)).toBe(POW_HARD_DIFFICULTY)
    expect(difficultyForScore(100)).toBe(POW_HARD_DIFFICULTY)
  })

  it('NaN/undefined трактуются как 0', () => {
    expect(difficultyForScore(undefined)).toBe(POW_MIN_DIFFICULTY)
    expect(difficultyForScore(Number.NaN)).toBe(POW_MIN_DIFFICULTY)
    expect(difficultyForScore(null)).toBe(POW_MIN_DIFFICULTY)
  })

  it('монотонно неубывает', () => {
    let prev = -1
    for (let s = 0; s <= 100; s += 5) {
      const d = difficultyForScore(s)
      expect(d).toBeGreaterThanOrEqual(prev)
      prev = d
    }
  })
})
