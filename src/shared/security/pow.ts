/**
 * Proof-of-Work на клиенте.
 * Клиент решает вычислительную задачу (подбор nonce), делая массовый парсинг невыгодным.
 */

import { sha256 } from './crypto'

/** Сложность по умолчанию (количество ведущих нулей hex SHA-256). */
export const DEFAULT_DIFFICULTY = 3

/**
 * Решает PoW-задачу: находит nonce, при котором SHA-256(`${challenge}:${nonce}`)
 * начинается с `difficulty` нулей.
 */
export async function solveChallenge(
  challenge: string,
  difficulty: number = DEFAULT_DIFFICULTY,
): Promise<string> {
  const prefix = '0'.repeat(difficulty)
  let nonce = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hash = await sha256(`${challenge}:${nonce}`)
    if (hash.startsWith(prefix)) return String(nonce)
    nonce++
  }
}

/** Проверка решения — для юнит-тестов. */
export async function verifyChallengeSolution(
  challenge: string,
  nonce: string,
  difficulty: number = DEFAULT_DIFFICULTY,
): Promise<boolean> {
  if (!nonce) return false
  const prefix = '0'.repeat(difficulty)
  const hash = await sha256(`${challenge}:${nonce}`)
  return hash.startsWith(prefix)
}
