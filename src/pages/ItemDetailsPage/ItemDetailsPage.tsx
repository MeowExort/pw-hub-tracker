import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getItemSpread,
  getPriceHistory,
  getShops,
  type ShopListItemExtended,
} from '@/shared/api/pshop'
import { usePShopServer } from '@/shared/hooks/usePShopServer'
import { ServerSelector } from '@/shared/ui/ServerSelector'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { PriceHistoryChart } from '@/shared/ui/PriceHistoryChart'
import { ItemDescription } from '@/shared/ui/ItemDescription'
import { ShopTooltip } from '@/shared/ui/ShopTooltip'
import { formatNumber, formatDate, daysAgoISO } from '@/shared/utils/pshop'
import styles from './ItemDetailsPage.module.scss'

type Period = '7d' | '30d' | '90d'

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

type OfferRow = {
  shopId: number
  playerId: number
  playerName: string
  price: number
  count: number
  lastSeenAt: string
}

function toRows(
  shops: ShopListItemExtended[] | undefined,
  itemId: number,
  isSell: boolean,
): OfferRow[] {
  if (!shops) return []
  return shops.flatMap((s) =>
    s.items
      .filter((i) => i.itemId === itemId && i.isSell === isSell)
      .map((i) => ({
        shopId: s.id,
        playerId: s.playerId,
        playerName: s.player?.name ?? `#${s.playerId}`,
        price: i.price,
        count: i.itemCount,
        lastSeenAt: s.lastSeenAt,
      })),
  )
}

export function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const itemId = parseInt(id || '0', 10)
  const [server, setServer] = usePShopServer()
  const [period, setPeriod] = useState<Period>('30d')

  const spreadQuery = useQuery({
    queryKey: ['item-spread', itemId, server],
    queryFn: () => getItemSpread(itemId, server),
    enabled: !!itemId,
  })

  const historyQuery = useQuery({
    queryKey: ['item-history', itemId, server, period],
    queryFn: () => getPriceHistory(itemId, server, { from: daysAgoISO(PERIOD_DAYS[period]) }),
    enabled: !!itemId,
  })

  const sellersQuery = useQuery({
    queryKey: ['item-sellers', itemId, server],
    queryFn: () =>
      getShops(server, {
        hasItemId: itemId,
        side: 'sell',
        isActive: true,
        orderBy: 'lastSeenAt',
        order: 'desc',
        pageSize: 100,
      }),
    enabled: !!itemId,
  })

  const buyersQuery = useQuery({
    queryKey: ['item-buyers', itemId, server],
    queryFn: () =>
      getShops(server, {
        hasItemId: itemId,
        side: 'buy',
        isActive: true,
        orderBy: 'lastSeenAt',
        order: 'desc',
        pageSize: 100,
      }),
    enabled: !!itemId,
  })

  const sellers = useMemo(
    () =>
      toRows(sellersQuery.data?.items, itemId, true).sort((a, b) => a.price - b.price),
    [sellersQuery.data, itemId],
  )
  const buyers = useMemo(
    () =>
      toRows(buyersQuery.data?.items, itemId, false).sort((a, b) => b.price - a.price),
    [buyersQuery.data, itemId],
  )

  const sellTotals = useMemo(() => {
    const count = sellers.reduce((s, r) => s + r.count, 0)
    const money = sellers.reduce((s, r) => s + r.price * r.count, 0)
    return { count, avg: count ? money / count : 0 }
  }, [sellers])

  const buyTotals = useMemo(() => {
    const count = buyers.reduce((s, r) => s + r.count, 0)
    const money = buyers.reduce((s, r) => s + r.price * r.count, 0)
    return { count, avg: count ? money / count : 0 }
  }, [buyers])

  if (spreadQuery.isLoading) return <Spinner />
  if (spreadQuery.error) return <ErrorMessage message={(spreadQuery.error as Error).message} />
  if (!spreadQuery.data) return <ErrorMessage message="Предмет не найден" />

  const details = spreadQuery.data
  const spreadValue = details.sell && details.buy ? details.buy.max - details.sell.min : null

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Link to="/items" className={styles.backLink}>← К списку предметов</Link>
          <h1 className={styles.title} style={{ color: details.nameColor ? `#${details.nameColor}` : undefined }}>
            {details.name}
          </h1>
        </div>
        <ServerSelector value={server} onChange={setServer} />
      </div>

      <div className={styles.layout}>
        {/* LEFT sticky column — item info + KPI */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.itemBasicInfo}>
              {details.icon && <img src={details.icon} alt="" className={styles.mainIcon} />}
              <div className={styles.basicText}>
                <span className={styles.id}>ID: {details.itemId}</span>
                <span className={styles.category}>{details.category || 'Без категории'}</span>
              </div>
            </div>
            {details.description ? (
              <ItemDescription text={details.description} className={styles.description} />
            ) : (
              <div className={styles.description}>Описание отсутствует</div>
            )}
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Сводка цен</h3>
            <div className={styles.priceGrid}>
              <div>
                <div className={styles.priceLabel}>Мин. продажа</div>
                <div className={styles.priceValue}>{formatNumber(details.sell?.min)}</div>
              </div>
              <div>
                <div className={styles.priceLabel}>Сред. продажа</div>
                <div className={styles.priceValue}>{formatNumber(details.sell?.avg)}</div>
              </div>
              <div>
                <div className={styles.priceLabel}>Макс. скупка</div>
                <div className={styles.priceValue}>{formatNumber(details.buy?.max)}</div>
              </div>
              <div>
                <div className={styles.priceLabel}>Спред</div>
                <div className={styles.priceValue}>
                  {spreadValue != null ? formatNumber(spreadValue) : '—'}
                </div>
              </div>
            </div>
          </div>

          {details.trendPrediction && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Прогноз тренда (7д)</h3>
              <div className={styles.trendBlock}>
                <div className={`${styles.trendIcon} ${styles[details.trendPrediction.direction]}`}>
                  {details.trendPrediction.direction === 'up' ? '▲' : details.trendPrediction.direction === 'down' ? '▼' : '●'}
                </div>
                <div className={styles.trendValue}>
                  <div className={styles.trendPercent}>
                    {details.trendPrediction.changePercent > 0 ? '+' : ''}
                    {details.trendPrediction.changePercent.toFixed(1)}%
                  </div>
                  <div className={styles.trendLabel}>Ожидаемое изменение</div>
                </div>
              </div>
              <div className={styles.confidence}>
                Уверенность: {(details.trendPrediction.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}

          <Link
            to={`/shops?hasItemId=${itemId}`}
            className={styles.openShopsLink}
          >
            Открыть все магазины с этим предметом →
          </Link>
        </aside>

        {/* CENTER — price history chart */}
        <main className={styles.content}>
          <div className={styles.card}>
            <div className={styles.chartHeader}>
              <h3 className={styles.cardTitle}>История цен</h3>
              <div className={styles.periodSelector}>
                {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
                  <button
                    key={p}
                    className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.chartWrapper}>
              {historyQuery.isLoading ? <Spinner /> : historyQuery.data && (
                <PriceHistoryChart data={historyQuery.data} height={350} />
              )}
            </div>
          </div>

          {/* Order book — под графиком, в две колонки */}
          <div className={styles.orderBook}>
            <OrderBookPanel
              title="Продавцы"
              subtitle="дешевле сверху"
              side="sell"
              rows={sellers}
              totals={sellTotals}
              isLoading={sellersQuery.isLoading}
              server={server}
              itemId={itemId}
            />
            <OrderBookPanel
              title="Скупщики"
              subtitle="дороже сверху"
              side="buy"
              rows={buyers}
              totals={buyTotals}
              isLoading={buyersQuery.isLoading}
              server={server}
              itemId={itemId}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

type OrderBookPanelProps = {
  title: string
  subtitle: string
  side: 'sell' | 'buy'
  rows: OfferRow[]
  totals: { count: number; avg: number }
  isLoading: boolean
  server: string
  itemId: number
}

function OrderBookPanel({ title, subtitle, side, rows, totals, isLoading, server, itemId }: OrderBookPanelProps) {
  const best = rows[0]?.price
  return (
    <div className={`${styles.card} ${styles.orderBookCard} ${styles[`side_${side}`]}`}>
      <div className={styles.orderBookHeader}>
        <div>
          <h3 className={styles.cardTitle}>{title}</h3>
          <div className={styles.orderBookSubtitle}>{subtitle}</div>
        </div>
        <div className={styles.orderBookBest}>
          <div className={styles.priceLabel}>
            {side === 'sell' ? 'Лучшая продажа' : 'Лучшая скупка'}
          </div>
          <div className={`${styles.priceValue} ${styles[`side_${side}_price`]}`}>
            {best != null ? formatNumber(best) : '—'}
          </div>
        </div>
      </div>

      <div className={styles.orderBookTotals}>
        <span>Всего: <b>{formatNumber(totals.count)}</b></span>
        <span>Ср. цена: <b>{totals.avg ? formatNumber(Math.round(totals.avg)) : '—'}</b></span>
      </div>

      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          {side === 'sell' ? 'Никто не продаёт этот предмет' : 'Никто не скупает этот предмет'}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.price}>Цена</th>
                <th className={styles.count}>Кол-во</th>
                <th>Игрок</th>
                <th>Видели</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.shopId}-${idx}`}>
                  <td className={`${styles.price} ${styles[`side_${side}_price`]}`}>
                    {formatNumber(r.price)}
                  </td>
                  <td className={styles.count}>{formatNumber(r.count)}</td>
                  <td>
                    <ShopTooltip
                      playerId={r.playerId}
                      server={server}
                      playerName={r.playerName}
                      highlightItemId={itemId}
                    >
                      <Link
                        to={`/shops/${server}/${r.playerId}`}
                        className={styles.playerLink}
                      >
                        {r.playerName}
                      </Link>
                    </ShopTooltip>
                  </td>
                  <td className={styles.seenAt}>{formatDate(r.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
