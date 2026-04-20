/**
 * Подпись запросов к BFF-прокси через HMAC-SHA256.
 * Подпись включает actionId, payload, timestamp, nonce, fingerprint — тем самым
 * исключает подделку, повтор и запрос с чужим fingerprint.
 */

import { hmacSha256, generateNonce } from './crypto'
import { getFingerprint } from './fingerprint'

/** Секрет подписи — подставляется Vite define при сборке. */
const SIGNING_SECRET: string = __SIGNING_SECRET__

/** Допустимое окно валидности timestamp на сервере (±30 секунд). */
export const TIMESTAMP_WINDOW_MS = 30_000

/** Подписанный запрос, который уходит в тело `POST /api/proxy`. */
export interface SignedProxyRequest {
  [key: string]: unknown
  /** Обфусцированный идентификатор действия */
  action: string
  /** JSON-строка с параметрами запроса */
  payload: string
  /** HMAC-SHA256 подпись */
  signature: string
  /** Временная метка (Unix ms) */
  timestamp: number
  /** Одноразовый токен */
  nonce: string
}

/**
 * Формирует подписанный запрос для отправки через BFF-прокси.
 * @param actionId — обфусцированный идентификатор действия (короткий хеш).
 */
export async function createSignedRequest(
  actionId: string,
  params: Record<string, unknown> = {},
): Promise<SignedProxyRequest> {
  const payload = JSON.stringify(params)
  const timestamp = Date.now()
  const nonce = generateNonce()
  const fingerprint = getFingerprint()

  const signatureInput = `${actionId}:${payload}:${timestamp}:${nonce}:${fingerprint}`
  const signature = await hmacSha256(signatureInput, SIGNING_SECRET)

  return { action: actionId, payload, signature, timestamp, nonce }
}
