import type {Collection, CollectionItem} from './types'

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
    {
        name: 'Оружие',
        icon: '⚔️',
        color: '#f97316',
        itemIds: [69141, 69139, 50263, 51678, 50265, 50261, 50247, 50251, 50249, 50253, 50257, 50255, 50259]
    },
    {
        name: 'ХХ',
        icon: '🛡️',
        color: '#ec4848',
        itemIds: [59713, 59965, 59966, 59967, 59968, 59970, 59971, 59972, 59973, 59974, 59975, 59976, 59977, 59978, 59980, 59981, 59982, 59983, 59984, 59985, 59986, 59987, 59989, 59990, 59991, 59992, 59993, 59994, 59995, 59996, 59998, 59999, 60017]
    },
    {
        name: 'ТС',
        icon: '👑',
        color: '#62fd9c',
        itemIds: [59713, 76085, 78760, 75897, 75941, 75910, 75912, 75914, 75916, 75900, 75902, 75904, 75906, 75908, 59975, 59976, 59977, 59978, 59970, 59971, 59972, 59973, 60017]
    },
    {
        name: 'Реликвия',
        icon: '💎',
        color: '#8b5cf6',
        itemIds: [79068, 41072, 47494, 79067, 52178, 52188, 52208, 52198, 52218]
    },
    {
        name: 'Рарки',
        icon: '✨',
        color: '#e1a829',
        itemIds: [48668, 60098, 65908, 36676, 72580, 87569, 84691, 75899, 68146, 68145, 71530, 59659, 43955]
    },
    {
        name: 'Накидка',
        icon: '🧥',
        color: '#8b5cf6',
        itemIds: [79070, 54953, 54952, 54951, 54950, 54949]
    },
    {
        name: 'Кольцо',
        icon: '💍',
        color: '#f65cee',
        itemIds: [79069, 54961, 54960, 54959, 54958]
    },
]

/** Создать элементы подборки из списка id предметов. */
function itemsFromIds(ids: readonly number[] | undefined, now: number): CollectionItem[] {
    if (!ids?.length) return []
    return ids.map((itemId) => ({itemId, addedAt: now}))
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
