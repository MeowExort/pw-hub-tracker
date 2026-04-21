/**
 * Клиентский менеджер session token (задача 5).
 *
 * Получает HMAC-токен с сервера через `POST /api/session` и хранит его в
 * `sessionStorage`. Токен привязан к ip+fp, TTL 10 минут. Автоматически
 * обновляется за 60 секунд до истечения.
 *
 * Использование:
 *   const token = await getSessionToken()   // возвращает действующий или получает новый
 *   clearSessionToken()                     // при 403/сбросе
 */
import { getFingerprint } from './fingerprint'
import { solveChallenge } from './pow'

const STORAGE_KEY = 'pwh.session'
const REFRESH_MARGIN_MS = 60_000 // за минуту до exp обновляем

interface StoredSession {
  token: string
  exp: number
}

interface PowChallenge {
  challenge: string
  difficulty: number
}

/** Текущее обещание, чтобы параллельные вызовы не плодили запросы. */
let pendingRequest: Promise<string | null> | null = null

function readStored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.exp !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(session: StoredSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // приватный режим / квота — игнорируем
  }
}

export function clearSessionToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Истёк/почти истёк ли токен. */
function isExpired(session: StoredSession | null): boolean {
  if (!session) return true
  return Date.now() >= session.exp - REFRESH_MARGIN_MS
}

async function fetchPow(): Promise<PowChallenge & { nonce: string }> {
  const res = await fetch('/api/pow-challenge', {
    method: 'GET',
    headers: { 'X-Client-FP': getFingerprint() },
  })
  if (!res.ok) throw new Error(`PoW challenge failed: ${res.status}`)
  const { challenge, difficulty } = (await res.json()) as PowChallenge
  const nonce = await solveChallenge(challenge, difficulty)
  return { challenge, nonce, difficulty }
}

async function issue(): Promise<string | null> {
  try {
    const pow = await fetchPow()
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-FP': getFingerprint(),
        'X-PoW-Challenge': pow.challenge,
        'X-PoW-Nonce': pow.nonce,
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as StoredSession
    if (!data || typeof data.token !== 'string' || typeof data.exp !== 'number') return null
    writeStored(data)
    return data.token
  } catch {
    return null
  }
}

/**
 * Возвращает действующий session token (или null, если получить не удалось).
 * Параллельные вызовы дожидаются одного запроса.
 */
export async function getSessionToken(): Promise<string | null> {
  const cached = readStored()
  if (cached && !isExpired(cached)) return cached.token
  if (pendingRequest) return pendingRequest
  pendingRequest = issue().finally(() => {
    pendingRequest = null
  })
  return pendingRequest
}

/** Быстрый неблокирующий доступ (без запроса). */
export function peekSessionToken(): string | null {
  const cached = readStored()
  if (!cached || isExpired(cached)) return null
  return cached.token
}
