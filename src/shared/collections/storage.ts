import type { CollectionsState } from './types'
import { createDefaultCollections } from './defaults'

export const COLLECTIONS_STORAGE_KEY = 'pw-hub:collections'
export const CURRENT_SCHEMA_VERSION = 1 as const

/** Сформировать начальное состояние с дефолтными подборками. */
export function createInitialState(): CollectionsState {
  const collections = createDefaultCollections()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    collections,
    activeCollectionId: collections[0]?.id ?? null,
  }
}

/** Прочитать состояние подборок из localStorage, применяя миграции. */
export function loadCollectionsState(): CollectionsState {
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as Partial<CollectionsState> | null
    if (!parsed || typeof parsed !== 'object') return createInitialState()
    const state = migrate(parsed)
    if (!state.collections || state.collections.length === 0) {
      return createInitialState()
    }
    return state
  } catch {
    return createInitialState()
  }
}

/** Сохранить состояние подборок в localStorage. */
export function saveCollectionsState(state: CollectionsState): void {
  try {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota/privacy errors
  }
}

function migrate(input: Partial<CollectionsState>): CollectionsState {
  const version = input.schemaVersion ?? 1
  const collections = Array.isArray(input.collections) ? input.collections : []
  const activeId = input.activeCollectionId ?? collections[0]?.id ?? null
  // Текущая версия 1 — место под будущие миграции.
  if (version > CURRENT_SCHEMA_VERSION) {
    return createInitialState()
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    collections,
    activeCollectionId: activeId,
  }
}
