import { apiGet } from './client'

/** Серверы PShop */
export const PSHOP_SERVERS = ['capella', 'centaur', 'alkor', 'mizar'] as const
export type PShopServer = (typeof PSHOP_SERVERS)[number]

/* ─── Типы ответов ─── */

/** Сводная статистика по одной стороне рынка (sell/buy) для /market-summary */
export interface MarketSideStats {
  isSell: boolean
  uniqueItems: number
  totalListings: number
  totalItemCount: number
  totalValue: number
  minPrice: number
  maxPrice: number
  avgPrice: number
}

export interface MarketSummary {
  server: string
  activeShops: number
  sell: MarketSideStats | null
  buy: MarketSideStats | null
}

/** Карточка предмета из ответов API */
export interface Item {
  id: number
  name: string
  nameColor: string
  description: string | null
  icon: string | null
}

/** Элемент /api/pshop/items/popular */
export interface PopularItem {
  itemId: number
  isSell: boolean
  item: Item | null
  shopCount: number
  totalCount: number
  minPrice: number
  maxPrice: number
  avgPrice: number
}

/** Точка гистограммы цен за час (период ≤ 90 дней) */
export interface PriceHistoryPriceBucket {
  price: number
  count: number
  soldCount: number
}

/** Точка часовой агрегации истории цен (≤ 90 дней) с гистограммой */
export interface PriceHistoryHourDetailed {
  hour: string
  isSell: boolean
  minPrice: number
  maxPrice: number
  avgPrice: number
  medianPrice: number
  totalCount: number
  shopCount: number
  prices: PriceHistoryPriceBucket[]
}

/** Точка агрегированной истории цен без гистограммы (hourly 90–365 дней, daily > 365 дней) */
export interface PriceHistoryAgg {
  isSell: boolean
  hour?: string
  day?: string
  minPrice: number
  maxPrice: number
  avgPrice: number
  medianPrice: number
  totalCount: number
  shopCount: number
}

/** Ответ /api/pshop/items/{itemId}/price-history */
export interface PriceHistoryResponse {
  item: Item | null
  granularity: 'hourly' | 'daily'
  items: (PriceHistoryHourDetailed | PriceHistoryAgg)[]
}

/** Ценовая статистика по стороне (/items, /items/{id}/spread) */
export interface PriceStats {
  min: number
  max: number
  avg: number
  median: number
  count: number
}

/** Прогноз тренда цены (ItemSpreadResponse) */
export interface TrendPrediction {
  direction: 'up' | 'down' | 'stable'
  changePercent: number
  confidence: number
}

/** Ответ /api/pshop/items/{itemId}/spread (ItemSpreadResponse) */
export interface SpreadResponse {
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

/** Сторона сделки в /trades/summary */
export interface TradeSideStats {
  isSell: boolean
  totalTrades: number
  totalItems: number
  totalMoney: number
  cheapestPrice: number
  mostExpensivePrice: number
  avgPrice: number
}

export interface TradesSummary {
  server: string
  from: string
  to: string
  sell: TradeSideStats | null
  buy: TradeSideStats | null
}

/** Элемент /trades/by-item */
export interface TradeByItem {
  itemId: number
  item: Item | null
  isSell: boolean
  totalTrades: number
  totalItems: number
  totalMoney: number
  cheapestPrice: number
  mostExpensivePrice: number
  avgPrice: number
}

export interface TradesByItemResponse {
  server: string
  from: string
  to: string
  total: number
  page: number
  pageSize: number
  items: TradeByItem[]
}

/** Короткая информация о магазине игрока (/players/{server}/{playerId}/shop) */
export interface ShopInfo {
  id: number
  playerId: number
  shopType: number
  createTime: string
  firstSeenAt: string
  lastSeenAt: string
  isActive: boolean
}

/** Предмет из /players/{server}/{playerId}/shop */
export interface ShopItem {
  itemId: number
  item: Item | null
  itemCount: number
  price: number
  isSell: boolean
}

export interface PlayerShopResponse {
  shop: ShopInfo
  items: ShopItem[]
}

/** Базовая информация об игроке */
export interface Player {
  id: number
  name: string
  cls: number
  gender: number
}

/** Предмет в составе магазина из /api/shops/{server} */
export interface ShopItemExtended {
  id: number
  itemId: number
  item: Item | null
  itemCount: number
  price: number
  isSell: boolean
}

/** Магазин игрока со сводкой из /api/shops/{server} */
export interface ShopListItemExtended {
  id: number
  server: string
  playerId: number
  player: Player | null
  shopType: number
  createTime: string
  firstSeenAt: string
  lastSeenAt: string
  isActive: boolean
  items: ShopItemExtended[]
  totalSellItems: number
  totalBuyItems: number
  totalSellMoney: number
  totalBuyMoney: number
  /** Количество лотов продажи (строк) — добавлено ТЗ варианта B */
  sellItemsCount?: number
  /** Количество лотов скупки (строк) — добавлено ТЗ варианта B */
  buyItemsCount?: number
}

/** Сводка по всей выдаче фильтра — из /api/shops/{server}.summary */
export interface ShopsListSummary {
  totalShops: number
  activeShops: number
  uniquePlayers: number
  totalSellMoney: number
  totalBuyMoney: number
  totalSellListings: number
  totalBuyListings: number
}

/** Ответ /api/shops/{server} */
export interface ShopListResponse {
  server: string
  total: number
  totalPages: number
  page: number
  pageSize: number
  orderBy: string
  order: string
  items: ShopListItemExtended[]
  /** Может отсутствовать, пока бекенд не обновлён */
  summary?: ShopsListSummary
}

export type ShopsOrderBy =
  | 'createTime'
  | 'totalBuyMoney'
  | 'totalSellMoney'
  | 'totalItems'
  | 'lastSeenAt'
  | 'firstSeenAt'
  | 'playerName'
export type Order = 'asc' | 'desc'
export type ShopsSide = 'any' | 'sell' | 'buy' | 'both'

/** Элемент автокомплита /api/shops/{server}/items-autocomplete */
export interface ShopsItemAutocompleteItem {
  id: number
  name: string
  icon: string | null
  nameColor: string
  shopsCount: number
}

/** Элемент /api/pshop/bots */
export interface BotListItem {
  playerId: number
  botEvents: number
  uniqueItems: number
  avgReactionSeconds: number
  lastDetectedAt: string
}

/** Событие в /api/pshop/players/{server}/{playerId}/bot-score */
export interface BotEvent {
  itemId: number
  item: Item | null
  isSell: boolean
  oldPrice: number
  newPrice: number
  competitorPrice: number
  reactionSeconds: number
  detectedAt: string
}

export interface BotScoreResponse {
  playerId: number
  server: string
  totalEvents: number
  events: BotEvent[]
}

/** Элемент грид предметов /api/pshop/items */
export interface ItemSearchItem {
  id: number
  name: string
  icon: string | null
  sell: PriceStats | null
  buy: PriceStats | null
}

export interface ItemSearchResponse {
  items: ItemSearchItem[]
  total: number
  page: number
  pageSize: number
}

/* ─── API-функции ─── */

export function getMarketSummary(server: string, params?: { excludeOutliers?: boolean }) {
  return apiGet<MarketSummary>('/api/pshop/market-summary', {
    server,
    excludeOutliers: params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

export type ItemsSortBy = 'minPrice' | 'maxPrice' | 'avgPrice' | 'medianPrice' | 'name'

export interface GetItemsParams {
  server: string
  search?: string
  minPrice?: number
  maxPrice?: number
  isSell?: boolean
  page?: number
  pageSize?: number
  sortBy?: ItemsSortBy
  sortOrder?: 'asc' | 'desc'
}

export function getItems(params: GetItemsParams) {
  return apiGet<ItemSearchResponse>('/api/pshop/items', {
    ...params,
    isSell: params.isSell !== undefined ? String(params.isSell) : undefined,
  } as Record<string, string | number | undefined>)
}

export function getPopularItems(
  server: string,
  params?: { isSell?: boolean; limit?: number; excludeOutliers?: boolean },
) {
  return apiGet<PopularItem[]>('/api/pshop/items/popular', {
    server,
    isSell: params?.isSell !== undefined ? String(params.isSell) : undefined,
    limit: params?.limit,
    excludeOutliers: params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

export function getPriceHistory(
  itemId: number,
  server: string,
  params?: { isSell?: boolean; from?: string; to?: string },
) {
  return apiGet<PriceHistoryResponse>(`/api/pshop/items/${itemId}/price-history`, {
    server,
    isSell: params?.isSell !== undefined ? String(params.isSell) : undefined,
    from: params?.from,
    to: params?.to,
  } as Record<string, string | number | undefined>)
}

export function getItemSpread(itemId: number, server: string, params?: { excludeOutliers?: boolean }) {
  return apiGet<SpreadResponse>(`/api/pshop/items/${itemId}/spread`, {
    server,
    excludeOutliers: params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

export function getTradesSummary(
  server: string,
  params?: { from?: string; to?: string; excludeOutliers?: boolean },
) {
  return apiGet<TradesSummary>('/api/pshop/trades/summary', {
    server,
    from: params?.from,
    to: params?.to,
    excludeOutliers: params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

export function getTradesByItem(
  server: string,
  params?: {
    itemId?: number
    from?: string
    to?: string
    page?: number
    pageSize?: number
    excludeOutliers?: boolean
  },
) {
  return apiGet<TradesByItemResponse>('/api/pshop/trades/by-item', {
    server,
    itemId: params?.itemId,
    from: params?.from,
    to: params?.to,
    page: params?.page,
    pageSize: params?.pageSize,
    excludeOutliers: params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

export function getPlayerShop(playerId: number, server: string) {
  return apiGet<PlayerShopResponse>(`/api/pshop/players/${server}/${playerId}/shop`)
}

export interface GetShopsParams {
  page?: number
  pageSize?: number
  orderBy?: ShopsOrderBy
  order?: Order
  search?: string
  shopType?: number | number[]
  hasItemId?: number
  hasItemSide?: boolean
  side?: ShopsSide
  activeWithinHours?: number
  isActive?: boolean
  minSellMoney?: number
  maxSellMoney?: number
  minBuyMoney?: number
  maxBuyMoney?: number
  playerId?: number
}

export function getShops(server: string, params?: GetShopsParams) {
  const query: Record<string, string | number | undefined | string[]> = {
    page: params?.page,
    pageSize: params?.pageSize,
    orderBy: params?.orderBy,
    order: params?.order,
    search: params?.search,
    hasItemId: params?.hasItemId,
    hasItemSide:
      params?.hasItemSide !== undefined ? String(params.hasItemSide) : undefined,
    side: params?.side,
    activeWithinHours: params?.activeWithinHours,
    isActive: params?.isActive !== undefined ? String(params.isActive) : undefined,
    minSellMoney: params?.minSellMoney,
    maxSellMoney: params?.maxSellMoney,
    minBuyMoney: params?.minBuyMoney,
    maxBuyMoney: params?.maxBuyMoney,
    playerId: params?.playerId,
  }
  if (params?.shopType !== undefined) {
    query.shopType = Array.isArray(params.shopType)
      ? params.shopType.map(String)
      : params.shopType
  }
  return apiGet<ShopListResponse>(
    `/api/shops/${server}`,
    query as Record<string, string | number | Array<string | number> | undefined>,
  )
}

export function getShopsItemsAutocomplete(
  server: string,
  params?: { search?: string; limit?: number; isSell?: boolean },
) {
  return apiGet<ShopsItemAutocompleteItem[]>(`/api/shops/${server}/items-autocomplete`, {
    search: params?.search,
    limit: params?.limit,
    isSell: params?.isSell !== undefined ? String(params.isSell) : undefined,
  } as Record<string, string | number | undefined>)
}

export function getBots(server: string, params?: { days?: number; minEvents?: number }) {
  return apiGet<BotListItem[]>('/api/pshop/bots', {
    server,
    days: params?.days,
    minEvents: params?.minEvents,
  } as Record<string, string | number | undefined>)
}

export function getBotScore(playerId: number, server: string, params?: { days?: number }) {
  return apiGet<BotScoreResponse>(`/api/pshop/players/${server}/${playerId}/bot-score`, {
    days: params?.days,
  } as Record<string, string | number | undefined>)
}
