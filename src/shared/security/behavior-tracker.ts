/**
 * Трекер поведения пользователя для оценки риска на BFF.
 *
 * Собирает лёгкие сигналы взаимодействия (мышь/клавиатура/скролл/тач/фокус)
 * и отдаёт компактный snapshot для заголовка `X-Behavior`.
 *
 * Задача:
 *  - отличать человека (движения мыши, посимвольный ввод) от бота
 *    (нет взаимодействий, массовые вставки).
 *  - полезная нагрузка заголовка < 200 байт.
 *
 * Счётчики сбрасываются раз в 60 секунд (скользящее окно).
 */

export interface BehaviorSnapshot {
  /** Сколько раз сработал mousemove за окно (после throttle). */
  mouseMoves: number
  /** Нажатия клавиш. */
  keyDowns: number
  /** События скролла. */
  scrolls: number
  /** События touchstart. */
  touches: number
  /** Смены видимости/фокуса окна. */
  focusChanges: number
  /** Сколько мс назад было последнее взаимодействие. */
  lastInteractionAgoMs: number
  /** Возраст сессии трекера, мс. */
  sessionAgeMs: number
  /** Характер ввода в поле поиска. */
  typingPattern: 'human' | 'paste' | 'none'
}

interface MutableState {
  mouseMoves: number
  keyDowns: number
  scrolls: number
  touches: number
  focusChanges: number
  lastInteractionAt: number
  windowStartedAt: number
  sessionStartedAt: number
  lastMouseMoveAt: number
  typingPattern: 'human' | 'paste' | 'none'
}

const WINDOW_MS = 60_000
const MOUSEMOVE_THROTTLE_MS = 100
const PASTE_LEN_THRESHOLD = 5

/**
 * Глобальное состояние (модульное). Инициализируется один раз,
 * повторный вызов `initBehaviorTracker` — no-op.
 */
let state: MutableState | null = null
let initialized = false

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function createState(): MutableState {
  const t = now()
  return {
    mouseMoves: 0,
    keyDowns: 0,
    scrolls: 0,
    touches: 0,
    focusChanges: 0,
    lastInteractionAt: 0,
    windowStartedAt: t,
    sessionStartedAt: t,
    lastMouseMoveAt: 0,
    typingPattern: 'none',
  }
}

function maybeRotateWindow(s: MutableState): void {
  const t = now()
  if (t - s.windowStartedAt >= WINDOW_MS) {
    s.mouseMoves = 0
    s.keyDowns = 0
    s.scrolls = 0
    s.touches = 0
    s.focusChanges = 0
    s.windowStartedAt = t
    // typingPattern сбрасываем только если не было новых нажатий — оставим как есть;
    // снэпшот сам отразит 'none' при нулевых счётчиках.
  }
}

/**
 * Инициализирует глобальные слушатели. Безопасно вызывать повторно.
 * Требует наличия `window`/`document` (в SSR — no-op).
 */
export function initBehaviorTracker(): void {
  if (initialized) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  initialized = true
  state = createState()
  const s = state

  const markInteraction = () => {
    s.lastInteractionAt = now()
  }

  window.addEventListener(
    'mousemove',
    () => {
      const t = now()
      if (t - s.lastMouseMoveAt < MOUSEMOVE_THROTTLE_MS) return
      s.lastMouseMoveAt = t
      maybeRotateWindow(s)
      s.mouseMoves++
      markInteraction()
    },
    { passive: true },
  )

  window.addEventListener(
    'scroll',
    () => {
      maybeRotateWindow(s)
      s.scrolls++
      markInteraction()
    },
    { passive: true },
  )

  window.addEventListener(
    'touchstart',
    () => {
      maybeRotateWindow(s)
      s.touches++
      markInteraction()
    },
    { passive: true },
  )

  document.addEventListener('visibilitychange', () => {
    maybeRotateWindow(s)
    s.focusChanges++
    markInteraction()
  })

  window.addEventListener('focus', () => {
    maybeRotateWindow(s)
    s.focusChanges++
    markInteraction()
  })

  window.addEventListener('blur', () => {
    maybeRotateWindow(s)
    s.focusChanges++
    markInteraction()
  })

  window.addEventListener('keydown', () => {
    maybeRotateWindow(s)
    s.keyDowns++
    // keydown вне поля ввода: как минимум, отметим ввод как человеческий,
    // если специального сигнала 'paste' ещё не было.
    if (s.typingPattern === 'none') s.typingPattern = 'human'
    markInteraction()
  })
}

/**
 * Регистрирует событие `input` в поисковом поле. Вызывать из
 * `<SearchInput>` (или аналогичных контролов), чтобы различать
 * посимвольный ввод и вставку.
 *
 * Если прирост длины > PASTE_LEN_THRESHOLD символов за одно событие —
 * считаем вставкой (или автозаполнением), что характерно для ботов.
 */
export function notifyTextInput(prevLength: number, newLength: number): void {
  if (!state) return
  const delta = newLength - prevLength
  if (delta > PASTE_LEN_THRESHOLD) {
    state.typingPattern = 'paste'
  } else if (delta > 0 && state.typingPattern !== 'paste') {
    state.typingPattern = 'human'
  }
  state.lastInteractionAt = now()
}

/** Текущий snapshot (или "пустой", если трекер не инициализирован). */
export function getBehaviorSnapshot(): BehaviorSnapshot {
  if (!state) {
    return {
      mouseMoves: 0,
      keyDowns: 0,
      scrolls: 0,
      touches: 0,
      focusChanges: 0,
      lastInteractionAgoMs: -1,
      sessionAgeMs: 0,
      typingPattern: 'none',
    }
  }
  maybeRotateWindow(state)
  const t = now()
  return {
    mouseMoves: state.mouseMoves,
    keyDowns: state.keyDowns,
    scrolls: state.scrolls,
    touches: state.touches,
    focusChanges: state.focusChanges,
    lastInteractionAgoMs: state.lastInteractionAt > 0 ? Math.round(t - state.lastInteractionAt) : -1,
    sessionAgeMs: Math.round(t - state.sessionStartedAt),
    typingPattern: state.typingPattern,
  }
}

/**
 * Base64url-значение для заголовка `X-Behavior` (компактный JSON).
 * Полезная нагрузка ≲ 200 байт.
 */
export function getBehaviorHeader(): string {
  const snap = getBehaviorSnapshot()
  // Сокращённые ключи — снижаем размер заголовка.
  const compact = {
    mm: snap.mouseMoves,
    kd: snap.keyDowns,
    sc: snap.scrolls,
    tc: snap.touches,
    fc: snap.focusChanges,
    la: snap.lastInteractionAgoMs,
    sa: snap.sessionAgeMs,
    tp: snap.typingPattern,
  }
  const json = JSON.stringify(compact)
  return toBase64Url(json)
}

function toBase64Url(s: string): string {
  // Node/Browser-совместимая реализация.
  let b64: string
  if (typeof btoa === 'function') {
    // В браузере btoa не поддерживает unicode — а нам и не надо, snapshot ASCII.
    b64 = btoa(s)
  } else {
    // Node/jsdom fallback.
    b64 = Buffer.from(s, 'utf-8').toString('base64')
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Для unit-тестов: полный сброс состояния. */
export function __resetBehaviorTrackerForTests(): void {
  state = null
  initialized = false
}
