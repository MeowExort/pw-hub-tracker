import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  getItemsBatch,
  type ItemCardDTO,
  type PriceStats,
  type PShopServer,
  type Sparkline,
  type TrendPrediction,
} from '@/shared/api/pshop'

/** Максимальный размер одного батч-запроса (см. ТЗ бэкенда). */
const BATCH_CHUNK_SIZE = 200

/**
 * Облегчённое представление предмета, совместимое по форме с `ItemDetailsResponse.info`,
 * чтобы переиспользовать существующие потребители (`CollectionItemCard`, сортировка/фильтр
 * на странице подборок). Тяжёлые поля (`history`, `sellers`, `buyers`) в батче не приходят —
 * их здесь нет, и они не нужны в гриде.
 */
export interface CollectionItemData {
  info: {
    itemId: number
    name: string
    nameColor: string
    icon: string | null
    description: string | null
    category: string | null
    sell: PriceStats | null
    buy: PriceStats | null
    trendPrediction: TrendPrediction | null
  }
  sparkline?: Sparkline
  stock?: ItemCardDTO['stock']
}

export interface CollectionItemsData {
  /** Словарь по itemId → данные предмета (или null, если предмет не найден/ошибка). */
  items: Record<number, CollectionItemData | null>
  /** id, отсутствующие в БД (поле `missing` из ответа API), объединены по чанкам. */
  missing: number[]
  /** Время формирования ответа сервером (ISO), либо время успешного ответа клиента. */
  updatedAt: number
}

/** Разбить массив на чанки длиной `size`. */
function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Привести ItemCardDTO к облегчённому представлению `CollectionItemData`. */
function mapCardToData(card: ItemCardDTO): CollectionItemData {
  const meta = card.meta
  return {
    info: {
      itemId: card.id,
      name: meta?.name ?? `#${card.id}`,
      nameColor: meta?.nameColor ?? '',
      icon: meta?.icon ?? null,
      description: meta?.description ?? null,
      category: meta?.category ?? null,
      sell: card.sell ?? null,
      buy: card.buy ?? null,
      trendPrediction: card.trendPrediction ?? null,
    },
    sparkline: card.sparkline,
    stock: card.stock,
  }
}

/**
 * Батч-загрузка предметов активной подборки через `POST /api/pshop/v2/items/batch`.
 * Если ids > 200, разбивается на чанки и запускается параллельно.
 * Ключ кэша зависит от `server` и отсортированного списка ids, поэтому смена сервера
 * или состава подборки автоматически приводит к рефетчу.
 */
export function useCollectionItems(ids: readonly number[], server: PShopServer) {
  const sortedIds = [...ids].sort((a, b) => a - b)
  const sortedKey = sortedIds.join(',')

  return useQuery<CollectionItemsData>({
    queryKey: ['collection-items-batch', server, sortedKey],
    enabled: ids.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const chunks = chunk(sortedIds, BATCH_CHUNK_SIZE)
      const responses = await Promise.all(
        chunks.map((c) =>
          getItemsBatch({
            server,
            ids: c,
            fields: ['meta', 'sell', 'buy', 'stock'],
          }),
        ),
      )

      const items: Record<number, CollectionItemData | null> = {}
      const missing: number[] = []
      let latestUpdatedAt = 0

      for (const res of responses) {
        for (const [idStr, card] of Object.entries(res.items)) {
          items[Number(idStr)] = mapCardToData(card)
        }
        missing.push(...res.missing)
        const ts = Date.parse(res.updatedAt)
        if (Number.isFinite(ts) && ts > latestUpdatedAt) latestUpdatedAt = ts
      }

      // Все id из запроса, которых нет ни в items, ни в missing — помечаем как null.
      for (const id of sortedIds) {
        if (!(id in items)) items[id] = null
      }

      return {
        items,
        missing,
        updatedAt: latestUpdatedAt || Date.now(),
      }
    },
  })
}
