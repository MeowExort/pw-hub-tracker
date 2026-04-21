import type { PShopServer } from '@/shared/api/pshop'

/**
 * Элемент внутри подборки — ссылка на предмет pshop + пользовательские метаданные.
 * Название, иконка, цены и прочее подгружаются из API по `itemId` на странице подборки,
 * поэтому здесь их не дублируем.
 */
export interface CollectionItem {
  itemId: number
  note?: string
  targetPrice?: number
  targetSide?: 'sell' | 'buy'
  addedAt: number
}

/** Подборка предметов пользователя. */
export interface Collection {
  id: string
  name: string
  icon?: string
  color?: string
  pinnedServer?: PShopServer
  isDefault: boolean
  items: CollectionItem[]
  createdAt: number
  updatedAt: number
}

/** Состояние модуля подборок, сохраняемое в localStorage. */
export interface CollectionsState {
  schemaVersion: 1
  collections: Collection[]
  activeCollectionId: string | null
}
