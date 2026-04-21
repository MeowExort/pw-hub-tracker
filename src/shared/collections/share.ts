/**
 * Клиент для экспорта/импорта подборок через BFF-короткие ссылки.
 *
 * POST /api/share   — создать шару, получить короткий код и URL.
 * GET  /api/share/:code — получить payload подборки по коду.
 *
 * На сервере payload хранится «как есть» (in-memory), поэтому тут мы
 * формируем стабильный, самодостаточный формат `CollectionShareV1`
 * (не тащим `id`/`isDefault`/`createdAt` оригинальной подборки, чтобы
 * при импорте всегда создавалась новая пользовательская подборка).
 */

import type { Collection, CollectionItem } from './types'

export const COLLECTION_SHARE_VERSION = 1 as const

export interface CollectionShareV1 {
  v: typeof COLLECTION_SHARE_VERSION
  name: string
  icon?: string
  color?: string
  pinnedServer?: Collection['pinnedServer']
  items: Array<{
    itemId: number
    note?: string
    targetPrice?: number
    targetSide?: 'sell' | 'buy'
  }>
}

export interface ShareCreateResponse {
  code: string
  url: string
  expiresAt: number
}

export interface ShareReadResponse {
  code: string
  kind: 'collection'
  payload: CollectionShareV1
  expiresAt: number
}

/** Преобразовать подборку в публичный payload (без приватных полей). */
export function collectionToSharePayload(c: Collection): CollectionShareV1 {
  return {
    v: COLLECTION_SHARE_VERSION,
    name: c.name,
    icon: c.icon,
    color: c.color,
    pinnedServer: c.pinnedServer,
    items: c.items.map((it) => ({
      itemId: it.itemId,
      note: it.note,
      targetPrice: it.targetPrice,
      targetSide: it.targetSide,
    })),
  }
}

/** Собрать элементы подборки из payload для создания новой Collection. */
export function sharePayloadToItems(p: CollectionShareV1): CollectionItem[] {
  const now = Date.now()
  const seen = new Set<number>()
  const out: CollectionItem[] = []
  for (const it of p.items ?? []) {
    const id = Number(it.itemId)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    out.push({
      itemId: id,
      note: typeof it.note === 'string' ? it.note : undefined,
      targetPrice: Number.isFinite(Number(it.targetPrice)) ? Number(it.targetPrice) : undefined,
      targetSide: it.targetSide === 'buy' ? 'buy' : it.targetSide === 'sell' ? 'sell' : undefined,
      addedAt: now,
    })
  }
  return out
}

/** Валидация входящего payload шары (минимальная, на случай порчи данных на сервере). */
export function isValidSharePayload(x: unknown): x is CollectionShareV1 {
  if (!x || typeof x !== 'object') return false
  const p = x as Partial<CollectionShareV1>
  if (p.v !== COLLECTION_SHARE_VERSION) return false
  if (typeof p.name !== 'string') return false
  if (!Array.isArray(p.items)) return false
  return true
}

/** Создать короткую ссылку на подборку. */
export async function createCollectionShare(c: Collection): Promise<ShareCreateResponse> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'collection',
      payload: collectionToSharePayload(c),
    }),
  })
  if (!res.ok) {
    const msg = await safeError(res)
    throw new Error(msg || `Не удалось создать ссылку (HTTP ${res.status})`)
  }
  return (await res.json()) as ShareCreateResponse
}

/** Прочитать подборку по короткому коду. */
export async function readCollectionShare(code: string): Promise<ShareReadResponse> {
  const clean = code.trim()
  if (!/^[A-Za-z0-9]{4,16}$/.test(clean)) {
    throw new Error('Некорректный код ссылки')
  }
  const res = await fetch(`/api/share/${encodeURIComponent(clean)}`)
  if (res.status === 404) throw new Error('Ссылка не найдена или истекла')
  if (!res.ok) {
    const msg = await safeError(res)
    throw new Error(msg || `Ошибка загрузки (HTTP ${res.status})`)
  }
  const data = (await res.json()) as ShareReadResponse
  if (data.kind !== 'collection' || !isValidSharePayload(data.payload)) {
    throw new Error('Неверный формат подборки')
  }
  return data
}

async function safeError(res: Response): Promise<string | null> {
  try {
    const j = await res.json()
    return j?.error ? String(j.error) : null
  } catch {
    return null
  }
}

/** Извлечь код шары из строки: код, полный URL или путь `/c/<code>`. */
export function extractShareCode(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (/^[A-Za-z0-9]{4,16}$/.test(s)) return s
  // пробуем как URL
  try {
    const u = new URL(s, window.location.origin)
    const q = u.searchParams.get('share')
    if (q && /^[A-Za-z0-9]{4,16}$/.test(q)) return q
    const m = u.pathname.match(/\/(?:c|share)\/([A-Za-z0-9]{4,16})\/?$/)
    if (m) return m[1]
  } catch {
    /* not an URL */
  }
  return null
}
