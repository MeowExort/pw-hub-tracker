/**
 * Синхронизация часов клиента с сервером.
 *
 * Сервер требует, чтобы `timestamp` в подписи отличался от его `Date.now()`
 * не более чем на ±30 секунд. У части пользователей часы ОС сбиты — без
 * коррекции их запросы массово падают с 403 «Неверная подпись».
 *
 * Источники серверного времени:
 *   • `GET /api/pow-challenge` возвращает поле `serverTime` (вызывается перед
 *     каждым `/api/proxy`, поэтому offset быстро становится актуальным);
 *   • при 403 с `clockSkew: true` ответ содержит `serverTime` — используется
 *     для одноразового реактивного ретрая.
 *
 * Хранится только в памяти модуля. После перезагрузки страницы offset
 * пересчитывается заново.
 */

let offsetMs = 0

/** Установить смещение по серверному времени (мс с эпохи UTC). */
export function setServerTime(serverTime: number): void {
  if (!Number.isFinite(serverTime)) return
  offsetMs = serverTime - Date.now()
}

/** Текущее «серверное» время для подписи запросов. */
export function clockNow(): number {
  return Date.now() + offsetMs
}

/** Текущее смещение часов в миллисекундах (для отладки/диагностики). */
export function getClockOffset(): number {
  return offsetMs
}
