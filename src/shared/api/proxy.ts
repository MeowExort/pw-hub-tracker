/**
 * Прокси-клиент для BFF.
 * Все запросы идут через единый `POST /api/proxy` с подписью, PoW, fingerprint
 * и обфусцированным идентификатором действия. Реальный путь API не попадает
 * в сетевую вкладку браузера.
 */

import { createSignedRequest } from '@/shared/security/signing'
import { getRateLimiter } from '@/shared/security/rate-limiter'
import { requestCaptcha, consumeCaptchaToken } from '@/shared/security/captcha'
import { solveChallenge } from '@/shared/security/pow'
import { getFingerprint } from '@/shared/security/fingerprint'
import { resolveRoute } from '@/shared/security/actions'
import { getBehaviorHeader } from '@/shared/security/behavior-tracker'
import { getSessionToken, peekSessionToken, clearSessionToken } from '@/shared/security/session-token'
import { setServerTime } from '@/shared/security/clock'

/** Ошибка API с HTTP-статусом */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Превышен лимит запросов */
export class RateLimitError extends Error {
  public retryAfterMs: number
  constructor(retryAfterMs: number) {
    super(`Превышен лимит запросов. Повторите через ${Math.ceil(retryAfterMs / 1000)} сек.`)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

/** Сервер требует пройти CAPTCHA */
export class CaptchaRequiredError extends Error {
  constructor() {
    super('Требуется прохождение CAPTCHA')
    this.name = 'CaptchaRequiredError'
  }
}

/** Ответ эндпоинта `GET /api/pow-challenge`. */
interface PowChallengeResponse {
  challenge: string
  difficulty: number
  /** Серверное время (Unix ms) — используется для синхронизации часов клиента. */
  serverTime?: number
}

interface PowSolution {
  challenge: string
  nonce: string
}

async function obtainPowSolution(): Promise<PowSolution> {
  const res = await fetch('/api/pow-challenge', {
    method: 'GET',
    headers: {
      'X-Client-FP': getFingerprint(),
    },
  })
  if (!res.ok) throw new ApiError(res.status, `Не удалось получить PoW challenge: ${res.status}`)
  const { challenge, difficulty, serverTime } = (await res.json()) as PowChallengeResponse
  if (typeof serverTime === 'number') setServerTime(serverTime)
  const nonce = await solveChallenge(challenge, difficulty)
  return { challenge, nonce }
}

/** Отправляет подписанный запрос через `POST /api/proxy`. */
async function sendProxyRequest<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal,
  captchaToken?: string,
  pow?: PowSolution,
  sessionToken?: string | null,
): Promise<T> {
  const token = captchaToken || consumeCaptchaToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-FP': getFingerprint(),
    'X-Behavior': getBehaviorHeader(),
  }
  if (token) headers['X-Captcha-Token'] = token
  if (pow) {
    headers['X-PoW-Challenge'] = pow.challenge
    headers['X-PoW-Nonce'] = pow.nonce
  }
  // Сессионный токен (задача 5) — прикрепляем, если доступен.
  const session = sessionToken === undefined ? peekSessionToken() : sessionToken
  if (session) headers['X-Session'] = session

  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let errText = ''
    try {
      errText = await res.text()
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errText || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  return (await res.text()) as unknown as T
}

/**
 * Отправляет запрос к API через BFF-прокси, сопоставляя реальный path
 * с зарегистрированным маршрутом (и его обфусцированным actionId).
 *
 * @param _retryAfterClockSkew — внутренний флаг, защищает от бесконечного цикла
 *   при ретрае после ответа `clockSkew: true`.
 */
export async function proxyRequest<T>(
  method: string,
  path: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
  _retryAfterClockSkew = false,
): Promise<T> {
  const route = resolveRoute(method, path)
  if (!route) {
    throw new Error(`Не зарегистрировано действие для ${method.toUpperCase()} ${path}`)
  }
  const fullParams = { ...route.pathParams, ...params }
  const actionId = route.actionId
  const isSearch = route.search
  const isMarket = route.market

  // Rate-limit применяется только к рыночным действиям (pshop/магазины/предметы).
  const limiter = isMarket ? getRateLimiter() : null
  if (limiter && !limiter.canRequest()) {
    throw new RateLimitError(limiter.getWaitTime())
  }
  limiter?.recordRequest()

  // Параллельно: подпись, PoW и session token (если нет в кэше — получаем).
  const [signedRequest, powSolution, sessionToken] = await Promise.all([
    createSignedRequest(actionId, fullParams),
    obtainPowSolution(),
    getSessionToken(),
  ])
  if (isSearch) signedRequest.search = true

  try {
    const result = await sendProxyRequest<T>(
      signedRequest,
      signal,
      undefined,
      powSolution,
      sessionToken,
    )
    limiter?.handleSuccess()
    return result
  } catch (error) {
    // Реактивная синхронизация часов: сервер сообщил, что timestamp подписи
    // вышел за окно ±30 сек. Подхватываем serverTime, обновляем offset и
    // повторяем запрос ровно один раз.
    if (
      error instanceof ApiError &&
      error.status === 403 &&
      !_retryAfterClockSkew
    ) {
      let parsed: { clockSkew?: boolean; serverTime?: number } | null = null
      try {
        parsed = JSON.parse(error.message)
      } catch {
        // Тело не JSON
      }
      if (parsed?.clockSkew && typeof parsed.serverTime === 'number') {
        setServerTime(parsed.serverTime)
        return proxyRequest<T>(method, path, params, signal, true)
      }
    }

    if (error instanceof ApiError && error.status === 429) {
      let retryAfterSec: string | undefined
      try {
        const parsed = JSON.parse(error.message)
        if (parsed.retryAfter) retryAfterSec = String(parsed.retryAfter)
      } catch {
        // Тело не JSON
      }
      if (limiter) {
        limiter.handleTooManyRequests(retryAfterSec)
        throw new RateLimitError(limiter.getWaitTime())
      }
      throw new RateLimitError(retryAfterSec ? Number(retryAfterSec) * 1000 : 1000)
    }

    // Бан или невалидная сессия — сбрасываем кэш токена.
    if (error instanceof ApiError && error.status === 403) {
      clearSessionToken()
    }

    // CAPTCHA-эскалация возможна только для рыночных действий.
    if (isMarket && error instanceof ApiError && error.status === 403) {
      let isCaptcha = false
      try {
        isCaptcha = JSON.parse(error.message).captchaRequired === true
      } catch {
        // Тело не JSON
      }
      if (isCaptcha) {
        const captchaToken = await requestCaptcha()
        const retryRequest = await createSignedRequest(actionId, fullParams)
        if (isSearch) retryRequest.search = true
        const retryPow = await obtainPowSolution()
        const retrySession = await getSessionToken()
        return sendProxyRequest<T>(retryRequest, signal, captchaToken, retryPow, retrySession)
      }
    }

    throw error
  }
}
