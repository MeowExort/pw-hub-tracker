/**
 * Генерация стабильного fingerprint браузера.
 * Используется в подписи запросов и для серверного rate-limiting.
 */

const FINGERPRINT_KEY = '__pwhub_tracker_fp__'

/** Простой FNV-1a хеш */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function collectBrowserTraits(): string[] {
  const traits: string[] = []
  traits.push(navigator.userAgent)
  traits.push(navigator.language)
  traits.push(Intl.DateTimeFormat().resolvedOptions().timeZone)
  traits.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)
  traits.push(navigator.platform)
  traits.push(String(navigator.hardwareConcurrency || 0))
  const nav = navigator as unknown as Record<string, unknown>
  if (nav.deviceMemory) traits.push(String(nav.deviceMemory))
  traits.push(String(navigator.maxTouchPoints || 0))
  return traits
}

/** Возвращает fingerprint устройства, кэшируя его в localStorage */
export function getFingerprint(): string {
  try {
    const cached = localStorage.getItem(FINGERPRINT_KEY)
    if (cached) return cached
  } catch {
    // localStorage недоступен — вычислим заново
  }

  const raw = collectBrowserTraits().join('|')
  const fingerprint = fnv1aHash(raw)

  try {
    localStorage.setItem(FINGERPRINT_KEY, fingerprint)
  } catch {
    // Игнорируем ошибки записи
  }
  return fingerprint
}

export function resetFingerprint(): void {
  try {
    localStorage.removeItem(FINGERPRINT_KEY)
  } catch {
    // ignore
  }
}
