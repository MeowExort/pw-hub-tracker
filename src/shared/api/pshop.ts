import { apiGet, apiPost } from './client'

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
  /** Присутствует только при withItemSpread=true (B4). */
  spread?: Spread
  /** Присутствует только при withItemSparkline=true (B4). */
  sparkline?: Sparkline
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
  /** Присутствует, если в запросе указан hasItemId (B6). */
  filterItem?: {
    id: number
    name: string
    icon: string | null
    nameColor: string
  }
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

/** Общий spread (sell/buy) — используется в v2-эндпоинтах и расширениях listing-ов. */
export interface Spread {
  sell: PriceStats | null
  buy: PriceStats | null
}

/** Агрегированная точка sparkline — из v2-эндпоинтов и listing-расширений (B1/B2/B4). */
export interface SparklinePoint {
  ts: string
  sellMedian: number | null
  buyMedian: number | null
}

/** Облегчённая историческая траектория — альтернатива PriceHistoryResponse для tooltip/превью. */
export interface Sparkline {
  from: string
  to: string
  bucket: 'hour' | 'day'
  points: SparklinePoint[]
}

/** Элемент грид предметов /api/pshop/items */
export interface ItemSearchItem {
  id: number
  name: string
  icon: string | null
  sell: PriceStats | null
  buy: PriceStats | null
  /** Присутствует только при withSparkline=true (B4). */
  sparkline?: Sparkline
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
  /** B4: включить sparkline в каждый ItemSearchItem. */
  withSparkline?: boolean
  sparklineDays?: 7 | 14 | 30
  sparklinePoints?: number
}

export function getItems(params: GetItemsParams) {
  return apiGet<ItemSearchResponse>('/api/pshop/items', {
    ...params,
    isSell: params.isSell !== undefined ? String(params.isSell) : undefined,
    withSparkline:
      params.withSparkline !== undefined ? String(params.withSparkline) : undefined,
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
  /** B4: включить spread в каждый ShopItemExtended. */
  withItemSpread?: boolean
  /** B4: включить sparkline в каждый ShopItemExtended. */
  withItemSparkline?: boolean
  sparklineDays?: 7 | 14 | 30
  sparklinePoints?: number
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
    withItemSpread:
      params?.withItemSpread !== undefined ? String(params.withItemSpread) : undefined,
    withItemSparkline:
      params?.withItemSparkline !== undefined ? String(params.withItemSparkline) : undefined,
    sparklineDays: params?.sparklineDays,
    sparklinePoints: params?.sparklinePoints,
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

/* ─── v2-агрегаты (B1/B2/B3/B5) ─── */

/** Ответ B1: GET /api/pshop/v2/players/{server}/{playerId}/shop-profile */
export interface ShopProfileResponse {
  shop: ShopInfo
  player: Player | null
  botScore: {
    totalEvents: number
    events: BotEvent[]
  }
  items: Array<{
    id: number
    itemId: number
    item: Item | null
    itemCount: number
    price: number
    isSell: boolean
    spread: Spread
    sparkline: Sparkline
  }>
  truncated: boolean
}

export function getShopProfile(
  server: string,
  playerId: number,
  params?: {
    historyDays?: 7 | 14 | 30
    sparklinePoints?: number
    excludeOutliers?: boolean
    itemsLimit?: number
  },
) {
  return apiGet<ShopProfileResponse>(
    `/api/pshop/v2/players/${server}/${playerId}/shop-profile`,
    {
      historyDays: params?.historyDays,
      sparklinePoints: params?.sparklinePoints,
      excludeOutliers:
        params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
      itemsLimit: params?.itemsLimit,
    } as Record<string, string | number | undefined>,
  )
}

/** Ответ B2: GET /api/pshop/v2/items/{itemId}/details */
export type ItemDetailsHistoryItem =
  | (PriceHistoryHourDetailed & { kind: 'hourly' })
  | {
      kind: 'daily'
      day: string
      isSell: boolean
      minPrice: number
      maxPrice: number
      avgPrice: number
      medianPrice: number
      totalCount: number
      shopCount: number
    }

export interface ItemDetailsResponse {
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
  history: {
    granularity: 'hourly' | 'daily'
    from: string
    to: string
    items: ItemDetailsHistoryItem[]
  }
  sellers: ItemDetailsOffersBlock
  buyers: ItemDetailsOffersBlock
}

export interface ItemDetailsOffer {
  shopId: number
  playerId: number
  player: Player | null
  price: number
  count: number
  lastSeenAt: string
  isActive: boolean
}

export interface ItemDetailsOffersBlock {
  total: number
  items: ItemDetailsOffer[]
}

export function getItemDetails(
  itemId: number,
  server: string,
  params?: {
    historyPeriod?: '7d' | '30d' | '90d' | '180d' | 'all'
    offersLimit?: number
    excludeOutliers?: boolean
  },
) {
  return apiGet<ItemDetailsResponse>(`/api/pshop/v2/items/${itemId}/details`, {
    server,
    historyPeriod: params?.historyPeriod,
    offersLimit: params?.offersLimit,
    excludeOutliers:
      params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

/** Ответ B3: GET /api/pshop/v2/market/dashboard */
export interface MarketDashboardResponse {
  summary: MarketSummary
  popular: {
    sell: PopularItem[]
    buy: PopularItem[]
  }
  trades: TradesSummary
}

export function getMarketDashboard(
  server: string,
  params?: {
    popularLimit?: number
    tradesPeriod?: '7d' | '30d' | '90d'
    excludeOutliers?: boolean
  },
) {
  return apiGet<MarketDashboardResponse>('/api/pshop/v2/market/dashboard', {
    server,
    popularLimit: params?.popularLimit,
    tradesPeriod: params?.tradesPeriod,
    excludeOutliers:
      params?.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

/** Ответ B5: GET /api/pshop/v2/trades/overview */
export interface TradesOverviewResponse {
  summary: TradesSummary
  byItem: TradesByItemResponse
}

export function getTradesOverview(
  server: string,
  params: {
    from: string
    to: string
    itemId?: number
    page?: number
    pageSize?: number
    excludeOutliers?: boolean
  },
) {
  return apiGet<TradesOverviewResponse>('/api/pshop/v2/trades/overview', {
    server,
    from: params.from,
    to: params.to,
    itemId: params.itemId,
    page: params.page,
    pageSize: params.pageSize,
    excludeOutliers:
      params.excludeOutliers !== undefined ? String(params.excludeOutliers) : undefined,
  } as Record<string, string | number | undefined>)
}

/* ─── Батч-информация по предметам (для страницы «Подборки») ─── */

/** Набор полей, которые можно запросить в батче. */
export type ItemsBatchField = 'meta' | 'sell' | 'buy' | 'sparkline' | 'trend' | 'stock'

/** Мета-информация предмета в батч-ответе. */
export interface ItemCardMeta {
  name: string
  nameColor: string
  icon: string | null
  description: string | null
  category: string | null
}

/** Остатки/активность по предмету. */
export interface ItemCardStock {
  sellListings: number
  sellTotalCount: number
  buyListings: number
  buyTotalCount: number
  activeShops: number
}

/** Карточка предмета в батч-ответе. Поля опциональны в зависимости от `fields`. */
export interface ItemCardDTO {
  id: number
  meta?: ItemCardMeta
  sell?: PriceStats | null
  buy?: PriceStats | null
  stock?: ItemCardStock
  sparkline?: Sparkline
  trendPrediction?: TrendPrediction | null
}

/** Ответ POST /api/pshop/v2/items/batch. */
export interface ItemsBatchResponse {
  updatedAt: string
  server: string
  missing: number[]
  /** Ключ — itemId в виде строки. */
  items: Record<string, ItemCardDTO>
}

export interface GetItemsBatchParams {
  server: PShopServer
  ids: number[]
  fields?: ItemsBatchField[]
  sparkline?: {
    days?: 7 | 14 | 30
    points?: number
    bucket?: 'hour' | 'day'
  }
  excludeOutliers?: boolean
}

/**
 * Батч-загрузка данных по предметам: одним HTTP-запросом возвращает мета/цены/стоки
 * (опционально sparkline и тренд) для всего списка `ids` (до 200).
 */
export function getItemsBatch(params: GetItemsBatchParams): Promise<ItemsBatchResponse> {
  return apiPost<ItemsBatchResponse>('/api/pshop/v2/items/batch', {
    server: params.server,
    ids: params.ids,
    fields: params.fields,
    sparkline: params.sparkline,
    excludeOutliers: params.excludeOutliers,
  })
}
