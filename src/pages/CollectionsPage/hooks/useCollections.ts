import { useCallback, useEffect, useRef, useState } from 'react'
import type { Collection, CollectionItem, CollectionsState } from '@/shared/collections'
import {
  createDefaultCollections,
  createInitialState,
  generateId,
  loadCollectionsState,
  saveCollectionsState,
} from '@/shared/collections'

export interface UseCollectionsApi {
  state: CollectionsState
  collections: Collection[]
  activeCollection: Collection | null
  setActiveCollection: (id: string) => void
  createCollection: (input: { name: string; icon?: string; color?: string }) => Collection
  importCollection: (input: { name: string; icon?: string; color?: string; pinnedServer?: Collection['pinnedServer']; items: CollectionItem[] }) => Collection
  updateCollection: (id: string, patch: Partial<Omit<Collection, 'id' | 'createdAt' | 'isDefault'>>) => void
  duplicateCollection: (id: string) => Collection | null
  deleteCollection: (id: string) => void
  undoDelete: () => void
  canUndo: boolean
  resetDefaults: () => void
  addItem: (collectionId: string, item: Omit<CollectionItem, 'addedAt'>) => void
  removeItem: (collectionId: string, itemId: number) => void
  updateItem: (collectionId: string, itemId: number, patch: Partial<CollectionItem>) => void
  moveItem: (fromId: string, toId: string, itemId: number) => void
}

/** CRUD-хук подборок с хранением в localStorage и поддержкой undo удаления. */
export function useCollections(): UseCollectionsApi {
  const [state, setState] = useState<CollectionsState>(() => loadCollectionsState())
  const undoRef = useRef<{ collection: Collection; prevActiveId: string | null } | null>(null)
  const [, forceRender] = useState(0)

  useEffect(() => {
    saveCollectionsState(state)
  }, [state])

  const activeCollection =
    state.collections.find((c) => c.id === state.activeCollectionId) ?? null

  const setActiveCollection = useCallback((id: string) => {
    setState((s) => ({ ...s, activeCollectionId: id }))
  }, [])

  const createCollection = useCallback(
    (input: { name: string; icon?: string; color?: string }) => {
      const now = Date.now()
      const collection: Collection = {
        id: generateId(),
        name: input.name.trim() || 'Новая подборка',
        icon: input.icon,
        color: input.color,
        isDefault: false,
        items: [],
        createdAt: now,
        updatedAt: now,
      }
      setState((s) => ({
        ...s,
        collections: [...s.collections, collection],
        activeCollectionId: collection.id,
      }))
      return collection
    },
    [],
  )

  const updateCollection = useCallback<UseCollectionsApi['updateCollection']>((id, patch) => {
    setState((s) => ({
      ...s,
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
      ),
    }))
  }, [])

  const importCollection = useCallback<UseCollectionsApi['importCollection']>((input) => {
    const now = Date.now()
    const baseName = input.name.trim() || 'Импорт подборки'
    let collection: Collection = {
      id: generateId(),
      name: baseName,
      icon: input.icon,
      color: input.color,
      pinnedServer: input.pinnedServer,
      isDefault: false,
      items: input.items.map((it) => ({ ...it })),
      createdAt: now,
      updatedAt: now,
    }
    setState((s) => {
      // Если имя занято — добавим суффикс «(импорт)», «(импорт 2)» и т.д.
      const names = new Set(s.collections.map((c) => c.name))
      if (names.has(collection.name)) {
        let candidate = `${baseName} (импорт)`
        let i = 2
        while (names.has(candidate)) {
          candidate = `${baseName} (импорт ${i})`
          i++
        }
        collection = { ...collection, name: candidate }
      }
      return {
        ...s,
        collections: [...s.collections, collection],
        activeCollectionId: collection.id,
      }
    })
    return collection
  }, [])

  const duplicateCollection = useCallback<UseCollectionsApi['duplicateCollection']>((id) => {
    let created: Collection | null = null
    setState((s) => {
      const src = s.collections.find((c) => c.id === id)
      if (!src) return s
      const now = Date.now()
      created = {
        ...src,
        id: generateId(),
        name: `${src.name} (копия)`,
        isDefault: false,
        items: src.items.map((it) => ({ ...it })),
        createdAt: now,
        updatedAt: now,
      }
      return { ...s, collections: [...s.collections, created], activeCollectionId: created.id }
    })
    return created
  }, [])

  const deleteCollection = useCallback<UseCollectionsApi['deleteCollection']>((id) => {
    setState((s) => {
      const target = s.collections.find((c) => c.id === id)
      if (!target) return s
      undoRef.current = { collection: target, prevActiveId: s.activeCollectionId }
      const rest = s.collections.filter((c) => c.id !== id)
      const nextActive =
        s.activeCollectionId === id ? rest[0]?.id ?? null : s.activeCollectionId
      return { ...s, collections: rest, activeCollectionId: nextActive }
    })
    forceRender((n) => n + 1)
  }, [])

  const undoDelete = useCallback(() => {
    const snapshot = undoRef.current
    if (!snapshot) return
    undoRef.current = null
    setState((s) => ({
      ...s,
      collections: [...s.collections, snapshot.collection],
      activeCollectionId: snapshot.prevActiveId ?? snapshot.collection.id,
    }))
    forceRender((n) => n + 1)
  }, [])

  const resetDefaults = useCallback(() => {
    setState((s) => {
      const user = s.collections.filter((c) => !c.isDefault)
      const defaults = createDefaultCollections()
      const all = [...defaults, ...user]
      return {
        ...s,
        collections: all,
        activeCollectionId: all[0]?.id ?? null,
      }
    })
  }, [])

  const addItem = useCallback<UseCollectionsApi['addItem']>((collectionId, item) => {
    setState((s) => ({
      ...s,
      collections: s.collections.map((c) => {
        if (c.id !== collectionId) return c
        if (c.items.some((it) => it.itemId === item.itemId)) return c
        return {
          ...c,
          items: [...c.items, { ...item, addedAt: Date.now() }],
          updatedAt: Date.now(),
        }
      }),
    }))
  }, [])

  const removeItem = useCallback<UseCollectionsApi['removeItem']>((collectionId, itemId) => {
    setState((s) => ({
      ...s,
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? { ...c, items: c.items.filter((it) => it.itemId !== itemId), updatedAt: Date.now() }
          : c,
      ),
    }))
  }, [])

  const updateItem = useCallback<UseCollectionsApi['updateItem']>((collectionId, itemId, patch) => {
    setState((s) => ({
      ...s,
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              items: c.items.map((it) => (it.itemId === itemId ? { ...it, ...patch } : it)),
              updatedAt: Date.now(),
            }
          : c,
      ),
    }))
  }, [])

  const moveItem = useCallback<UseCollectionsApi['moveItem']>((fromId, toId, itemId) => {
    if (fromId === toId) return
    setState((s) => {
      const src = s.collections.find((c) => c.id === fromId)
      const item = src?.items.find((it) => it.itemId === itemId)
      if (!src || !item) return s
      return {
        ...s,
        collections: s.collections.map((c) => {
          if (c.id === fromId) {
            return { ...c, items: c.items.filter((it) => it.itemId !== itemId), updatedAt: Date.now() }
          }
          if (c.id === toId) {
            if (c.items.some((it) => it.itemId === itemId)) return c
            return { ...c, items: [...c.items, item], updatedAt: Date.now() }
          }
          return c
        }),
      }
    })
  }, [])

  // safety: восстановить дефолты, если вдруг всё удалили
  useEffect(() => {
    if (state.collections.length === 0) {
      setState(createInitialState())
    }
  }, [state.collections.length])

  return {
    state,
    collections: state.collections,
    activeCollection,
    setActiveCollection,
    createCollection,
    importCollection,
    updateCollection,
    duplicateCollection,
    deleteCollection,
    undoDelete,
    canUndo: undoRef.current !== null,
    resetDefaults,
    addItem,
    removeItem,
    updateItem,
    moveItem,
  }
}
