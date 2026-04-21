import type { Collection, CollectionItem } from './types'

/** Сгенерировать uuid для подборки/элемента. */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Описание предустановленной подборки.
 * `itemIds` — список id предметов pshop, которыми подборка будет предзаполнена
 * (без цен/названий/иконок — они подгружаются из API).
 */
export interface DefaultCollectionPreset {
  name: string
  icon: string
  color: string
  itemIds?: number[]
}

/** Предустановленные подборки под сценарии PW. */
export const DEFAULT_COLLECTION_PRESETS: DefaultCollectionPreset[] = [
  { name: 'Оружие', icon: '⚔️', color: '#f97316', itemIds: [69139, 51678, 50263] },
  { name: 'ХХ3', icon: '💍', color: '#ec4899', itemIds: [59998, 59989] },
  { name: 'ТС', icon: '🧪', color: '#22c55e', itemIds: [59989] },
  { name: 'Рарки', icon: '🐉', color: '#8b5cf6', itemIds: [60098, 48668] },
]

/** Создать элементы подборки из списка id предметов. */
function itemsFromIds(ids: readonly number[] | undefined, now: number): CollectionItem[] {
  if (!ids?.length) return []
  return ids.map((itemId) => ({ itemId, addedAt: now }))
}

/** Создать предзаполненные подборки под сценарии PW. */
export function createDefaultCollections(
  presets: readonly DefaultCollectionPreset[] = DEFAULT_COLLECTION_PRESETS,
): Collection[] {
  const now = Date.now()
  return presets.map((p) => ({
    id: generateId(),
    name: p.name,
    icon: p.icon,
    color: p.color,
    isDefault: true,
    items: itemsFromIds(p.itemIds, now),
    createdAt: now,
    updatedAt: now,
  }))
}
