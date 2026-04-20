import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  getMarketSummary,
  getPopularItems,
  getTradesSummary,
  type PopularItem,
} from '@/shared/api/pshop'
import { ServerSelector } from '@/shared/ui/ServerSelector'
import { usePShopServer } from '@/shared/hooks/usePShopServer'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { ItemTooltip } from '@/shared/ui/ItemTooltip'
import { formatNumber } from '@/shared/utils/pshop'
import styles from '@/shared/styles/pshop.module.scss'

/** Страница «Дашборд рынка» (Вариант C: витрина предметов) */
export function MarketDashboardPage() {
  const [server, setServer] = usePShopServer()

  const summary = useQuery({
    queryKey: ['market-summary', server],
    queryFn: () => getMarketSummary(server),
  })

  const popularSell = useQuery({
    queryKey: ['items-popular', server, 'sell', 10],
    queryFn: () => getPopularItems(server, { isSell: true, limit: 10 }),
  })

  const popularBuy = useQuery({
    queryKey: ['items-popular', server, 'buy', 10],
    queryFn: () => getPopularItems(server, { isSell: false, limit: 10 }),
  })

  const trades = useQuery({
    queryKey: ['trades-summary', server],
    queryFn: () => getTradesSummary(server),
  })

  const isLoading =
    summary.isLoading || popularSell.isLoading || popularBuy.isLoading || trades.isLoading
  const error = summary.error || popularSell.error || popularBuy.error || trades.error

  const turnover30d =
    (trades.data?.sell?.totalMoney ?? 0) + (trades.data?.buy?.totalMoney ?? 0)
  const trades30d =
    (trades.data?.sell?.totalTrades ?? 0) + (trades.data?.buy?.totalTrades ?? 0)

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Дашборд рынка</h1>
        <ServerSelector value={server} onChange={setServer} />
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorMessage message={(error as Error).message} />}

      {/* KPI-полоска */}
      {summary.data && (
        <div className={styles.kpiStrip}>
          <div className={styles.kpiItem}>
            🏪 <strong>{formatNumber(summary.data.activeShops)}</strong> магазинов
          </div>
          {summary.data.sell && (
            <div className={styles.kpiItem}>
              <span className={styles.sell}>📈</span>{' '}
              <strong>{formatNumber(summary.data.sell.totalListings)}</strong> лот. продажи
            </div>
          )}
          {summary.data.buy && (
            <div className={styles.kpiItem}>
              <span className={styles.buy}>📉</span>{' '}
              <strong>{formatNumber(summary.data.buy.totalListings)}</strong> лот. скупки
            </div>
          )}
          {trades.data && (
            <>
              <div className={styles.kpiItem}>
                💰 <strong>{formatNumber(turnover30d)}</strong> оборот / 30д
              </div>
              <div className={styles.kpiItem}>
                🔄 <strong>{formatNumber(trades30d)}</strong> сделок / 30д
              </div>
            </>
          )}
        </div>
      )}

      {/* Витрина: Топ продажи */}
      {popularSell.data && popularSell.data.length > 0 && (
        <div className={styles.section}>
          <div className={`${styles.sectionTitle} ${styles.sell}`}>
            📈 Топ популярных — продажа
          </div>
          <div className={styles.itemGrid}>
            {popularSell.data.map((row, i) => renderItemCard(row, i, server))}
          </div>
        </div>
      )}

      {/* Витрина: Топ скупки */}
      {popularBuy.data && popularBuy.data.length > 0 && (
        <div className={styles.section}>
          <div className={`${styles.sectionTitle} ${styles.buy}`}>
            📉 Топ популярных — скупка
          </div>
          <div className={styles.itemGrid}>
            {popularBuy.data.map((row, i) => renderItemCard(row, i, server))}
          </div>
        </div>
      )}

      {/* Подробная статистика: Рынок сейчас */}
      {summary.data && (
        <details className={styles.detailsSection}>
          <summary>📊 Подробная статистика рынка</summary>
          <div className={styles.twoColumns}>
            <div>
              <div className={`${styles.columnTitle} ${styles.sell}`}>📈 Продажа</div>
              {summary.data.sell ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Листингов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.sell.totalListings)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Стоимость витрины</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.sell.totalValue)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Уникальных предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.sell.uniqueItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Средняя цена</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.sell.avgPrice)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>Нет данных о продажах</div>
              )}
            </div>
            <div>
              <div className={`${styles.columnTitle} ${styles.buy}`}>📉 Скупка</div>
              {summary.data.buy ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Листингов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.buy.totalListings)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Стоимость бюджета</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.buy.totalValue)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Уникальных предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.buy.uniqueItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Средняя цена</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summary.data.buy.avgPrice)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>Нет данных о скупке</div>
              )}
            </div>
          </div>
        </details>
      )}

      {/* Подробная статистика: Сделки за 30 дней */}
      {trades.data && (
        <details className={styles.detailsSection}>
          <summary>💰 Подробная статистика сделок за 30 дней</summary>
          <div className={styles.twoColumns}>
            <div>
              <div className={`${styles.columnTitle} ${styles.sell}`}>📈 Продажи</div>
              {trades.data.sell ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Сделок</div>
                    <div className={styles.cardValue}>
                      {formatNumber(trades.data.sell.totalTrades)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(trades.data.sell.totalItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Оборот</div>
                    <div className={styles.cardValue}>
                      {formatNumber(trades.data.sell.totalMoney)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>Нет данных</div>
              )}
            </div>
            <div>
              <div className={`${styles.columnTitle} ${styles.buy}`}>📉 Скупки</div>
              {trades.data.buy ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Сделок</div>
                    <div className={styles.cardValue}>
                      {formatNumber(trades.data.buy.totalTrades)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(trades.data.buy.totalItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Оборот</div>
                    <div className={styles.cardValue}>
                      {formatNumber(trades.data.buy.totalMoney)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>Нет данных</div>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

function renderItemCard(row: PopularItem, i: number, server: string) {
  return (
    <ItemTooltip
      key={`${row.itemId}-${row.isSell}-${i}`}
      itemId={row.itemId}
      server={server}
      name={row.item?.name ?? `#${row.itemId}`}
      icon={row.item?.icon ?? ''}
      nameColor={row.item?.nameColor}
    >
      <Link to={`/items/${row.itemId}`} className={styles.itemCard}>
        <div className={styles.itemCardHead}>
          <img src={row.item?.icon ?? ''} alt="" className={styles.itemCardIcon} />
          <div className={styles.itemCardName}>
            {row.item?.name ?? `#${row.itemId}`}
          </div>
        </div>
        <div className={styles.itemCardPrice}>{formatNumber(row.isSell ? row.minPrice : row.maxPrice)}</div>
        <div className={styles.itemCardMeta}>
          <span>🏪 {row.shopCount}</span>
          <span>×{formatNumber(row.totalCount)}</span>
        </div>
        <div className={styles.itemCardMeta}>
          <span>мин {formatNumber(row.minPrice)}</span>
          <span>макс {formatNumber(row.maxPrice)}</span>
        </div>
      </Link>
    </ItemTooltip>
  )
}
