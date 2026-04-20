/**
 * Управление CAPTCHA (hCaptcha).
 * Сервер требует токен при подозрительной активности, клиент показывает виджет,
 * получает токен и передаёт его в следующем запросе.
 */

/** Публичный sitekey hCaptcha */
const HCAPTCHA_SITE_KEY = 'a5000400-bdd8-4fda-8148-b26cb9fea64c'

interface CaptchaState {
  required: boolean
  token: string | null
  resolveCallback: ((token: string) => void) | null
  rejectCallback: ((reason: Error) => void) | null
}

const state: CaptchaState = {
  required: false,
  token: null,
  resolveCallback: null,
  rejectCallback: null,
}

type CaptchaListener = (required: boolean) => void
const listeners = new Set<CaptchaListener>()

export function onCaptchaRequired(listener: CaptchaListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn(state.required))
}

export function isCaptchaRequired(): boolean {
  return state.required
}

export function getCaptchaToken(): string | null {
  return state.token
}

export function getHcaptchaSiteKey(): string {
  return HCAPTCHA_SITE_KEY
}

/** Сервер потребовал CAPTCHA — возвращает промис, резолвится токеном после решения. */
export function requestCaptcha(): Promise<string> {
  state.required = true
  state.token = null
  notifyListeners()

  return new Promise<string>((resolve, reject) => {
    state.resolveCallback = resolve
    state.rejectCallback = reject
  })
}

/** CAPTCHA решена пользователем. */
export function solveCaptcha(token: string): void {
  state.token = token
  state.required = false
  notifyListeners()

  if (state.resolveCallback) {
    state.resolveCallback(token)
    state.resolveCallback = null
    state.rejectCallback = null
  }
}

/** Пользователь отменил CAPTCHA. */
export function cancelCaptcha(): void {
  state.required = false
  state.token = null
  notifyListeners()

  if (state.rejectCallback) {
    state.rejectCallback(new Error('CAPTCHA отменена пользователем'))
    state.resolveCallback = null
    state.rejectCallback = null
  }
}

/** Одноразовое использование токена. */
export function consumeCaptchaToken(): string | null {
  const token = state.token
  state.token = null
  return token
}

export function resetCaptchaState(): void {
  state.required = false
  state.token = null
  state.resolveCallback = null
  state.rejectCallback = null
  listeners.clear()
}
