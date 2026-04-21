/**
 * Динамическая сложность PoW (задача 3).
 *
 * Сложность = количество ведущих нулей в hex SHA-256.
 * Маппинг по risk score (preliminary, до записи в rate-limit):
 *    score < 40  → 3 (≈ десятки мс)
 *    40..69      → 4 (≈ сотни мс)
 *    ≥ 70        → 5 (≈ 1–3 с)
 *
 * Пороговые значения синхронизированы с эскалацией в `/api/proxy`.
 */

export const POW_MIN_DIFFICULTY = 3
export const POW_MID_DIFFICULTY = 4
export const POW_HARD_DIFFICULTY = 5

/**
 * @param {number} score — 0..100 (NaN/undefined трактуется как 0).
 * @returns {number} — 3, 4 или 5.
 */
export function difficultyForScore(score) {
  const s = typeof score === 'number' && Number.isFinite(score) ? score : 0
  if (s >= 70) return POW_HARD_DIFFICULTY
  if (s >= 40) return POW_MID_DIFFICULTY
  return POW_MIN_DIFFICULTY
}
