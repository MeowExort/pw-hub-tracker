/**
 * HTTP-клиент для запросов к PW Hub Tracker API.
 *
 * Все запросы идут через BFF-прокси (`POST /api/proxy`) с HMAC-подписью,
 * PoW и обфусцированным action. Реальные пути API (`/api/arena/...` и т. п.)
 * используются только в целях внутренней маршрутизации на клиенте и полностью
 * скрыты от сетевой вкладки браузера. Публичные сигнатуры `apiGet`/`apiPost`
 * сохранены ради совместимости с `src/shared/api/*`.
 */

import { proxyRequest } from './proxy'

export { ApiError, RateLimitError, CaptchaRequiredError } from './proxy'

type ParamValue = string | number | boolean | Array<string | number | boolean> | undefined | null
type Params = Record<string, ParamValue>

function cleanParams(params?: Params): Record<string, unknown> {
  if (!params) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    out[key] = value
  }
  return out
}

/** GET-запрос — внутренне разруливается в actionId через карту маршрутов. */
export function apiGet<T>(path: string, params?: Params): Promise<T> {
  return proxyRequest<T>('GET', path, cleanParams(params))
}

/** POST-запрос. Массивы/примитивы оборачиваются в `__body`, BFF разворачивает. */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  let params: Record<string, unknown>
  if (body === undefined || body === null) {
    params = {}
  } else if (typeof body === 'object' && !Array.isArray(body)) {
    params = body as Record<string, unknown>
  } else {
    params = { __body: body }
  }
  return proxyRequest<T>('POST', path, params)
}

/** PUT-запрос. */
export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const params =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : body !== undefined && body !== null
        ? { __body: body }
        : {}
  return proxyRequest<T>('PUT', path, params)
}

/** DELETE-запрос. */
export function apiDelete<T>(path: string, params?: Params): Promise<T> {
  return proxyRequest<T>('DELETE', path, cleanParams(params))
}
