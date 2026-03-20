/**
 * HTTP-клиент для прямых запросов к PW Hub Tracker API.
 * Без прокси — запросы идут напрямую к бэкенду.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.tracker.pw-hub.ru'

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

/**
 * GET-запрос к API.
 * @param path — путь эндпоинта (например, `/api/arena/teams`)
 * @param params — query-параметры
 */
export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

/**
 * POST-запрос к API.
 * @param path — путь эндпоинта
 */
export async function apiPost<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}: ${res.statusText}`)
  }
  return res.json()
}
