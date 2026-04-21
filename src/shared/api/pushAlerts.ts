/**
 * Клиентский API для push-подписок и таргет-алертов PW Hub.
 *
 * В отличие от основного pshop-API эти эндпоинты живут ВНУТРИ BFF
 * (`server/index.js` — контуры `/api/push/*`, `/api/alerts/*`) и НЕ проксируют
 * запросы в реальный апстрим. Поэтому здесь мы ходим прямым `fetch`,
 * без `apiGet/apiPost` (которые уходят в `/api/proxy` с подписью/PoW).
 *
 * Все запросы идентифицируются заголовком `X-User-Id` — стабильный идентификатор
 * клиента, генерируемый на лету в `getOrCreateUserId()` и хранимый в localStorage.
 */

import type { PShopServer } from './pshop'

const USER_ID_STORAGE_KEY = 'pw-hub:userId'

/**
 * Получить (или создать) стабильный идентификатор пользователя для push/alerts.
 * Это НЕ логин — лишь привязка подписок и таргетов к конкретному браузеру.
 */
export function getOrCreateUserId(): string {
  try {
    const existing = localStorage.getItem(USER_ID_STORAGE_KEY)
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing
  } catch {
    /* SSR / заблокированный storage */
  }
  const id = generateUserId()
  try {
    localStorage.setItem(USER_ID_STORAGE_KEY, id)
  } catch {
    /* noop */
  }
  return id
}

function generateUserId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // URL-safe base64, без паддинга.
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const userId = getOrCreateUserId()
  const resp = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`${resp.status} ${resp.statusText}: ${text || path}`)
  }
  if (resp.status === 204) return undefined as T
  return (await resp.json()) as T
}

// --- VAPID / Push ---

export function getVapidPublicKey(): Promise<{ key: string }> {
  return request('GET', '/api/push/vapid-public')
}

export function subscribePush(subscription: PushSubscriptionJSON): Promise<{ ok: true }> {
  return request('POST', '/api/push/subscribe', { subscription })
}

export function unsubscribePush(endpoint: string): Promise<{ ok: true }> {
  return request('DELETE', '/api/push/subscribe', { endpoint })
}

// --- Alerts ---

export type AlertDirection = '<=' | '>='
export type AlertSide = 'sell' | 'buy'

export interface AlertDTO {
  id: string
  userId: string
  itemId: number
  server: PShopServer
  side: AlertSide
  targetPrice: number
  direction: AlertDirection
  cooldownMin: number
  expiresAt?: number
  createdAt: number
  lastFiredAt?: number
}

export interface CreateAlertInput {
  itemId: number
  server: PShopServer
  side: AlertSide
  targetPrice: number
  direction: AlertDirection
  cooldownMin?: number
  expiresAt?: number
}

export function listAlerts(): Promise<{ items: AlertDTO[] }> {
  return request('GET', '/api/alerts')
}

export function createAlert(input: CreateAlertInput): Promise<AlertDTO> {
  return request('POST', '/api/alerts', input)
}

export function deleteAlert(id: string): Promise<{ ok: true }> {
  return request('DELETE', `/api/alerts/${encodeURIComponent(id)}`)
}

export function sendTestPush(): Promise<{ sent: number; removed: number }> {
  return request('POST', '/api/alerts/test', {})
}
