import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMarketDashboard, type PopularItem } from '@/shared/api/pshop'
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

  // B3: единый запрос вместо 4-х отдельных.
  const dashboard = useQuery({
    queryKey: ['market-dashboard', server],
    queryFn: () =>
      getMarketDashboard(server, { popularLimit: 10, tradesPeriod: '30d' }),
  })

  const summaryData = dashboard.data?.summary
  const popularSellData = dashboard.data?.popular.sell
  const popularBuyData = dashboard.data?.popular.buy
  const tradesData = dashboard.data?.trades

  const isLoading = dashboard.isLoading
  const error = dashboard.error

  const turnover30d =
    (tradesData?.sell?.totalMoney ?? 0) + (tradesData?.buy?.totalMoney ?? 0)
  const trades30d =
    (tradesData?.sell?.totalTrades ?? 0) + (tradesData?.buy?.totalTrades ?? 0)

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Дашборд рынка</h1>
        <ServerSelector value={server} onChange={setServer} />
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorMessage message={(error as Error).message} />}

      {/* KPI-полоска */}
      {summaryData && (
        <div className={styles.kpiStrip}>
          <div className={styles.kpiItem}>
            🏪 <strong>{formatNumber(summaryData.activeShops)}</strong> магазинов
          </div>
          {summaryData.sell && (
            <div className={styles.kpiItem}>
              <span className={styles.sell}>📈</span>{' '}
              <strong>{formatNumber(summaryData.sell.totalListings)}</strong> лот. продажи
            </div>
          )}
          {summaryData.buy && (
            <div className={styles.kpiItem}>
              <span className={styles.buy}>📉</span>{' '}
              <strong>{formatNumber(summaryData.buy.totalListings)}</strong> лот. скупки
            </div>
          )}
          {tradesData && (
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
      {popularSellData && popularSellData.length > 0 && (
        <div className={styles.section}>
          <div className={`${styles.sectionTitle} ${styles.sell}`}>
            📈 Топ популярных — продажа
          </div>
          <div className={styles.itemGrid}>
            {popularSellData.map((row, i) => renderItemCard(row, i, server))}
          </div>
        </div>
      )}

      {/* Витрина: Топ скупки */}
      {popularBuyData && popularBuyData.length > 0 && (
        <div className={styles.section}>
          <div className={`${styles.sectionTitle} ${styles.buy}`}>
            📉 Топ популярных — скупка
          </div>
          <div className={styles.itemGrid}>
            {popularBuyData.map((row, i) => renderItemCard(row, i, server))}
          </div>
        </div>
      )}

      {/* Подробная статистика: Рынок сейчас */}
      {summaryData && (
        <details className={styles.detailsSection}>
          <summary>📊 Подробная статистика рынка</summary>
          <div className={styles.twoColumns}>
            <div>
              <div className={`${styles.columnTitle} ${styles.sell}`}>📈 Продажа</div>
              {summaryData.sell ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Листингов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.sell.totalListings)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Стоимость витрины</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.sell.totalValue)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Уникальных предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.sell.uniqueItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Средняя цена</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.sell.avgPrice)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>Нет данных о продажах</div>
              )}
            </div>
            <div>
              <div className={`${styles.columnTitle} ${styles.buy}`}>📉 Скупка</div>
              {summaryData.buy ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Листингов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.buy.totalListings)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Стоимость бюджета</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.buy.totalValue)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Уникальных предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.buy.uniqueItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Средняя цена</div>
                    <div className={styles.cardValue}>
                      {formatNumber(summaryData.buy.avgPrice)}
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
      {tradesData && (
        <details className={styles.detailsSection}>
          <summary>💰 Подробная статистика сделок за 30 дней</summary>
          <div className={styles.twoColumns}>
            <div>
              <div className={`${styles.columnTitle} ${styles.sell}`}>📈 Продажи</div>
              {tradesData.sell ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Сделок</div>
                    <div className={styles.cardValue}>
                      {formatNumber(tradesData.sell.totalTrades)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(tradesData.sell.totalItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Оборот</div>
                    <div className={styles.cardValue}>
                      {formatNumber(tradesData.sell.totalMoney)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>Нет данных</div>
              )}
            </div>
            <div>
              <div className={`${styles.columnTitle} ${styles.buy}`}>📉 Скупки</div>
              {tradesData.buy ? (
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Сделок</div>
                    <div className={styles.cardValue}>
                      {formatNumber(tradesData.buy.totalTrades)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Предметов</div>
                    <div className={styles.cardValue}>
                      {formatNumber(tradesData.buy.totalItems)}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Оборот</div>
                    <div className={styles.cardValue}>
                      {formatNumber(tradesData.buy.totalMoney)}
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
