import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getTradesOverview,
  getShopsItemsAutocomplete,
  type TradeByItem,
  type TradeSideStats,
} from '@/shared/api/pshop'
import { ServerSelector } from '@/shared/ui/ServerSelector'
import { usePShopServer } from '@/shared/hooks/usePShopServer'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { formatNumber, daysAgoISO } from '@/shared/utils/pshop'
import { ClearableInput } from '@/shared/ui/ClearableInput'
import styles from './TradeAnalyticsPage.module.scss'

const PAGE_SIZE = 50

type SideFilter = 'all' | 'sell' | 'buy'

interface PeriodPreset {
  key: string
  label: string
  days: number | null // null → «всё время»
}

const PRESETS: PeriodPreset[] = [
  { key: '7', label: '7 дней', days: 7 },
  { key: '30', label: '30 дней', days: 30 },
  { key: '90', label: '90 дней', days: 90 },
  { key: 'all', label: 'Всё время', days: null },
]

/** Завтра в ISO (YYYY-MM-DD). Используется как верхняя граница фильтра «По»,
 *  т.к. бэкенд трактует `to` как «до» (не включая). */
const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Страница «Аналитика сделок» — split-view Продажи ↔ Скупки */
export function TradeAnalyticsPage() {
  const [server, setServer] = usePShopServer()

  const [fromDate, setFromDate] = useState(() => daysAgoISO(30).slice(0, 10))
  const [toDate, setToDate] = useState(() => tomorrow())
  const [activePreset, setActivePreset] = useState<string | null>('30')

  // Выбранный предмет (itemId + имя + иконка)
  const [itemId, setItemId] = useState<number | undefined>(undefined)
  const [itemName, setItemName] = useState<string>('')
  const [itemIcon, setItemIcon] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')

  // Автокомплит
  const [itemSearch, setItemSearch] = useState('')
  const deferredItemSearch = useDebouncedValue(itemSearch.trim())
  const [acOpen, setAcOpen] = useState(false)
  const acRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) setAcOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const autocomplete = useQuery({
    queryKey: ['shops-items-autocomplete', server, deferredItemSearch],
    queryFn: () =>
      getShopsItemsAutocomplete(server, { search: deferredItemSearch || undefined, limit: 15 }),
    enabled: acOpen && itemId === undefined,
  })

  const applyPreset = (preset: PeriodPreset) => {
    setActivePreset(preset.key)
    setToDate(tomorrow())
    if (preset.days === null) {
      // «всё время» — условно очень ранняя дата
      setFromDate('2020-01-01')
    } else {
      setFromDate(daysAgoISO(preset.days).slice(0, 10))
    }
    setPage(1)
  }

  // B5: единый запрос summary + byItem.
  const overview = useQuery({
    queryKey: ['trades-overview', server, fromDate, toDate, itemId, page],
    queryFn: () =>
      getTradesOverview(server, {
        from: fromDate,
        to: toDate,
        itemId,
        page,
        pageSize: PAGE_SIZE,
      }),
  })

  const summary = { data: overview.data?.summary, error: overview.error, isLoading: overview.isLoading }
  const byItem = {
    data: overview.data?.byItem,
    error: overview.error,
    isLoading: overview.isLoading,
  }

  const top10Sell = useMemo(() => {
    if (!byItem.data) return []
    return byItem.data.items
      .filter((i) => i.isSell)
      .sort((a, b) => b.totalMoney - a.totalMoney)
      .slice(0, 10)
  }, [byItem.data])

  const top10Buy = useMemo(() => {
    if (!byItem.data) return []
    return byItem.data.items
      .filter((i) => !i.isSell)
      .sort((a, b) => b.totalMoney - a.totalMoney)
      .slice(0, 10)
  }, [byItem.data])

  const tableItems = useMemo(() => {
    if (!byItem.data) return []
    const list = [...byItem.data.items].sort((a, b) => b.totalMoney - a.totalMoney)
    if (sideFilter === 'sell') return list.filter((i) => i.isSell)
    if (sideFilter === 'buy') return list.filter((i) => !i.isSell)
    return list
  }, [byItem.data, sideFilter])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Аналитика сделок</h1>
        <ServerSelector
          value={server}
          onChange={(s) => {
            setServer(s)
            setPage(1)
          }}
        />
      </div>

      {/* ── Фильтры ── */}
      <div className={styles.filtersPanel}>
        <div className={styles.filtersRow}>
          <div className={styles.presetGroup}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`${styles.presetBtn} ${activePreset === p.key ? styles.presetBtnActive : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className={styles.filterGroup}>
            С:{' '}
            <input
              type="date"
              className={styles.dateInput}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setActivePreset(null)
                setPage(1)
              }}
            />
          </label>
          <label className={styles.filterGroup}>
            По:{' '}
            <input
              type="date"
              className={styles.dateInput}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setActivePreset(null)
                setPage(1)
              }}
            />
          </label>

          {(itemId !== undefined || fromDate !== daysAgoISO(30).slice(0, 10) || toDate !== tomorrow()) && (
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => {
                setItemId(undefined)
                setItemName('')
                setItemIcon(null)
                setItemSearch('')
                applyPreset(PRESETS[1])
              }}
            >
              Сбросить
            </button>
          )}
        </div>

        <div className={styles.filtersRow}>
          {itemId !== undefined ? (
            <span className={styles.selectedItemChip}>
              {itemIcon && <img src={itemIcon} alt="" />}
              Предмет: <strong>{itemName || `#${itemId}`}</strong>
              <button
                type="button"
                onClick={() => {
                  setItemId(undefined)
                  setItemName('')
                  setItemIcon(null)
                  setPage(1)
                }}
                aria-label="Убрать фильтр"
              >
                ×
              </button>
            </span>
          ) : (
            <div className={styles.autocompleteBox} ref={acRef}>
              <ClearableInput
                className={styles.input}
                type="text"
                placeholder="Найти сделки по предмету…"
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value)
                  setAcOpen(true)
                }}
                onClear={() => {
                  setItemSearch('')
                  setAcOpen(true)
                }}
                onFocus={() => setAcOpen(true)}
              />
              {acOpen && autocomplete.data && autocomplete.data.length > 0 && (
                <div className={styles.autocompleteList}>
                  {autocomplete.data.map((it) => (
                    <div
                      key={it.id}
                      className={styles.autocompleteItem}
                      onClick={() => {
                        setItemId(it.id)
                        setItemName(it.name)
                        setItemIcon(it.icon)
                        setItemSearch('')
                        setAcOpen(false)
                        setPage(1)
                      }}
                    >
                      {it.icon && <img src={it.icon} alt="" />}
                      <span style={{ color: it.nameColor || undefined }}>{it.name}</span>
                      <span className={styles.autocompleteCount}>в {it.shopsCount} маг.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Split-view ── */}
      {summary.isLoading && <Spinner />}
      {summary.error && <ErrorMessage message={(summary.error as Error).message} />}

      {summary.data && (
        <div className={styles.split}>
          <SideColumn
            kind="sell"
            stats={summary.data.sell}
            topItems={top10Sell}
            title="Продажи"
            icon="📈"
          />
          <SideColumn
            kind="buy"
            stats={summary.data.buy}
            topItems={top10Buy}
            title="Скупки"
            icon="📉"
          />
        </div>
      )}

      {/* ── Таблица ── */}
      {byItem.isLoading && <Spinner />}
      {byItem.error && <ErrorMessage message={(byItem.error as Error).message} />}

      {byItem.data && (
        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>📋 Сделки по предметам</h2>
            <div className={styles.sideFilter}>
              {(['all', 'sell', 'buy'] as SideFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.presetBtn} ${sideFilter === s ? styles.presetBtnActive : ''}`}
                  onClick={() => setSideFilter(s)}
                >
                  {s === 'all' ? 'Все' : s === 'sell' ? 'Продажи' : 'Скупки'}
                </button>
              ))}
            </div>
          </div>

          {tableItems.length === 0 ? (
            <div className={styles.emptyState}>Нет данных о сделках за выбранный период</div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Предмет</th>
                    <th>Тип</th>
                    <th>Сделок</th>
                    <th>Предметов</th>
                    <th>Оборот</th>
                    <th>Мин. цена</th>
                    <th>Макс. цена</th>
                    <th>Средняя</th>
                  </tr>
                </thead>
                <tbody>
                  {tableItems.map((t, i) => (
                    <tr key={`${t.itemId}-${t.isSell}-${i}`}>
                      <td>
                        <div className={styles.itemCell}>
                          {t.item?.icon && <img src={t.item.icon} alt="" />}
                          <Link to={`/items/${t.itemId}`} style={{ color: t.item?.nameColor || undefined }}>
                            {t.item?.name || `#${t.itemId}`}
                          </Link>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.typeBadge} ${t.isSell ? styles.sell : styles.buy}`}>
                          {t.isSell ? 'Продажа' : 'Скупка'}
                        </span>
                      </td>
                      <td>{formatNumber(t.totalTrades)}</td>
                      <td>{formatNumber(t.totalItems)}</td>
                      <td>{formatNumber(t.totalMoney)}</td>
                      <td>{formatNumber(t.cheapestPrice)}</td>
                      <td>{formatNumber(t.mostExpensivePrice)}</td>
                      <td>{formatNumber(t.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                total={byItem.data.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Колонка split-view: Продажи или Скупки */
function SideColumn({
  kind,
  stats,
  topItems,
  title,
  icon,
}: {
  kind: 'sell' | 'buy'
  stats: TradeSideStats | null
  topItems: TradeByItem[]
  title: string
  icon: string
}) {
  const sideClass = kind === 'sell' ? styles.sellSide : styles.buySide
  const colorClass = kind === 'sell' ? styles.sell : styles.buy
  const maxMoney = topItems[0]?.totalMoney || 0

  return (
    <section className={`${styles.sideColumn} ${sideClass}`}>
      <header className={styles.sideHeader}>
        <h2 className={`${styles.sideTitle} ${colorClass}`}>
          <span>{icon}</span> {title}
        </h2>
        {stats && (
          <span className={styles.sideBadge}>
            Ср. цена: {formatNumber(stats.avgPrice)}
          </span>
        )}
      </header>

      {stats ? (
        <div className={styles.kpiRow}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Сделок</div>
            <div className={`${styles.kpiValue} ${colorClass}`}>
              {formatNumber(stats.totalTrades)}
            </div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Предметов</div>
            <div className={styles.kpiValue}>{formatNumber(stats.totalItems)}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Оборот</div>
            <div className={`${styles.kpiValue} ${colorClass}`}>
              {formatNumber(stats.totalMoney)}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>Нет данных</div>
      )}

      <h3 className={styles.topBlockTitle}>🏆 Топ-10 по обороту</h3>

      {topItems.length === 0 ? (
        <div className={styles.emptyState}>Нет сделок</div>
      ) : (
        <div className={styles.topList}>
          {topItems.map((t, idx) => {
            const pct = maxMoney > 0 ? (t.totalMoney / maxMoney) * 100 : 0
            return (
              <Link
                key={`${t.itemId}-${idx}`}
                to={`/items/${t.itemId}`}
                className={styles.topItem}
              >
                <span className={styles.topRank}>{idx + 1}</span>
                {t.item?.icon ? (
                  <img className={styles.topIcon} src={t.item.icon} alt="" />
                ) : (
                  <div className={styles.topIcon} />
                )}
                <div className={styles.topBody}>
                  <div
                    className={styles.topName}
                    style={{ color: t.item?.nameColor || undefined }}
                  >
                    {t.item?.name || `#${t.itemId}`}
                  </div>
                  <div className={styles.topMeta}>
                    {formatNumber(t.totalTrades)} сделок • ср. {formatNumber(t.avgPrice)}
                  </div>
                </div>
                <div className={`${styles.topMoney} ${colorClass}`}>
                  {formatNumber(t.totalMoney)}
                </div>
                <div
                  className={`${styles.topBar} ${colorClass}`}
                  style={{ width: `${pct}%` }}
                />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
