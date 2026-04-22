import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getShops,
  getShopsItemsAutocomplete,
  type GetShopsParams,
  type Order,
  type ShopsOrderBy,
  type ShopsSide,
} from '@/shared/api/pshop'
import { ServerSelector } from '@/shared/ui/ServerSelector'
import { usePShopServer } from '@/shared/hooks/usePShopServer'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { formatDate, formatNumber } from '@/shared/utils/pshop'
import { PlayerTooltip } from '@/shared/ui/PlayerTooltip'
import { ItemTooltip } from '@/shared/ui/ItemTooltip'
import { ClearableInput } from '@/shared/ui/ClearableInput'
import { NumberInput } from '@/shared/ui/NumberInput/NumberInput'
import { notifyTextInput } from '@/shared/security/behavior-tracker'
import styles from './ShopsPage.module.scss'

const PAGE_SIZE = 15


const ORDER_BY_VALUES: ShopsOrderBy[] = [
  'createTime',
  'totalSellMoney',
  'totalBuyMoney',
  'totalItems',
  'playerName',
]

function parseOrderBy(v: string | null): ShopsOrderBy {
  return (ORDER_BY_VALUES as string[]).includes(v ?? '')
    ? (v as ShopsOrderBy)
    : 'createTime'
}

function parseSide(v: string | null): ShopsSide {
  return v === 'sell' || v === 'buy' || v === 'both' ? v : 'any'
}


/** Страница «Магазины» — поиск/каталог (Вариант B) */
export function ShopsPage() {
  const [server, setServer] = usePShopServer()
  const [searchParams, setSearchParams] = useSearchParams()

  // --- Состояние из URL ---
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const orderBy = parseOrderBy(searchParams.get('orderBy'))
  const order: Order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

  const side = parseSide(searchParams.get('side'))
  const hasItemId = searchParams.get('hasItemId') ? parseInt(searchParams.get('hasItemId')!, 10) : undefined

  const minSellMoney = searchParams.get('minSellMoney') || ''
  const maxSellMoney = searchParams.get('maxSellMoney') || ''
  const minBuyMoney = searchParams.get('minBuyMoney') || ''
  const maxBuyMoney = searchParams.get('maxBuyMoney') || ''

  // Поиск: локальный input → deferred → URL
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const deferredSearch = useDebouncedValue(searchInput.trim())

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    const prev = searchParams.get('search') || ''
    if (deferredSearch === prev) return
    if (deferredSearch) next.set('search', deferredSearch)
    else next.delete('search')
    next.delete('page')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch])

  const updateParams = (mutate: (p: URLSearchParams) => void, resetPage = true) => {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    if (resetPage) next.delete('page')
    setSearchParams(next, { replace: true })
  }

  // --- Запрос магазинов ---
  const queryParams: GetShopsParams = {
    page,
    pageSize: PAGE_SIZE,
    orderBy,
    order,
    search: deferredSearch || undefined,
    side: side !== 'any' ? side : undefined,
    isActive: true,
    hasItemId,
    minSellMoney: minSellMoney ? Number(minSellMoney) : undefined,
    maxSellMoney: maxSellMoney ? Number(maxSellMoney) : undefined,
    minBuyMoney: minBuyMoney ? Number(minBuyMoney) : undefined,
    maxBuyMoney: maxBuyMoney ? Number(maxBuyMoney) : undefined,
  }

  const shops = useQuery({
    queryKey: ['shops', server, queryParams],
    queryFn: () => getShops(server, queryParams),
  })

  // B6: бэкенд возвращает filterItem при наличии hasItemId — отдельный запрос больше не нужен.
  const hasItemName = shops.data?.filterItem?.name || ''
  const hasItemIcon = shops.data?.filterItem?.icon || ''

  // --- Автокомплит предметов ---
  const [itemSearch, setItemSearch] = useState('')
  const deferredItemSearch = useDebouncedValue(itemSearch.trim())
  const [acOpen, setAcOpen] = useState(false)
  const autocomplete = useQuery({
    queryKey: ['shops-items-autocomplete', server, deferredItemSearch],
    queryFn: () => getShopsItemsAutocomplete(server, { search: deferredItemSearch || undefined, limit: 15 }),
    enabled: acOpen && !hasItemId,
  })

  const acRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) setAcOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggleSort = (field: ShopsOrderBy) => {
    updateParams((p) => {
      if (orderBy === field) {
        p.set('order', order === 'asc' ? 'desc' : 'asc')
      } else {
        p.set('orderBy', field)
        p.set('order', 'desc')
      }
    })
  }

  const renderSortIcon = (field: ShopsOrderBy) => {
    if (orderBy !== field) return null
    return <span>{order === 'asc' ? ' ↑' : ' ↓'}</span>
  }

  const resetFilters = () => {
    setSearchInput('')
    setItemSearch('')
    const next = new URLSearchParams()
    setSearchParams(next, { replace: true })
  }

  const hasAnyFilter =
    !!deferredSearch ||
    side !== 'any' ||
    hasItemId !== undefined ||
    !!minSellMoney ||
    !!maxSellMoney ||
    !!minBuyMoney ||
    !!maxBuyMoney

  const summary = shops.data?.summary

  // fallback-сводка по текущей странице, если бекенд ещё не отдаёт summary
  const fallbackSummary = useMemo(() => {
    if (summary || !shops.data) return null
    const items = shops.data.items
    return {
      totalShops: shops.data.total,
      activeShops: items.filter((s) => s.isActive).length,
      uniquePlayers: new Set(items.map((s) => s.playerId)).size,
      totalSellMoney: items.reduce((a, s) => a + (s.totalSellMoney || 0), 0),
      totalBuyMoney: items.reduce((a, s) => a + (s.totalBuyMoney || 0), 0),
      totalSellListings: items.reduce((a, s) => a + (s.sellItemsCount ?? s.items.filter((i) => i.isSell).length), 0),
      totalBuyListings: items.reduce((a, s) => a + (s.buyItemsCount ?? s.items.filter((i) => !i.isSell).length), 0),
    }
  }, [summary, shops.data])

  const kpi = summary ?? fallbackSummary

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Магазины</h1>
        <ServerSelector
          value={server}
          onChange={(s) => {
            setServer(s)
            updateParams((p) => p.delete('page'))
          }}
        />
      </div>

      {/* Фильтры */}
      <div className={styles.filters}>
        <div className={styles.filtersRow}>
          <div className={styles.searchBox}>
            <ClearableInput
              className={styles.input}
              type="text"
              placeholder="Поиск по имени игрока…"
              value={searchInput}
              onChange={(e) => { notifyTextInput(searchInput.length, e.target.value.length); setSearchInput(e.target.value) }}
              onClear={() => { notifyTextInput(searchInput.length, 0); setSearchInput('') }}
            />
          </div>

          <select
            className={styles.select}
            value={side}
            onChange={(e) =>
              updateParams((p) => {
                const v = e.target.value
                if (v === 'any') p.delete('side')
                else p.set('side', v)
              })
            }
          >
            <option value="any">Любая сторона</option>
            <option value="sell">Только продажа</option>
            <option value="buy">Только скупка</option>
            <option value="both">И продажа, и скупка</option>
          </select>



          {hasAnyFilter && (
            <button type="button" className={styles.resetBtn} onClick={resetFilters}>
              Сбросить фильтры
            </button>
          )}
        </div>

        <div className={styles.filtersRow}>
          {/* Фильтр по наличию предмета */}
          {hasItemId ? (
            <span className={styles.selectedItemChip}>
              {hasItemIcon && <img src={hasItemIcon} alt="" />}
              Есть предмет: <strong>{hasItemName || `#${hasItemId}`}</strong>
              <button
                type="button"
                onClick={() =>
                  updateParams((p) => {
                    p.delete('hasItemId')
                  })
                }
                aria-label="Убрать фильтр"
              >
                ×
              </button>
            </span>
          ) : (
            <div className={styles.autocompleteBox} ref={acRef}>
              <ClearableInput
                className={styles.input}
                style={{ width: '100%' }}
                type="text"
                placeholder="Найти магазины с предметом…"
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
                        updateParams((p) => {
                          p.set('hasItemId', String(it.id))
                        })
                        setItemSearch('')
                        setAcOpen(false)
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

          <NumberInput
            className={`${styles.input} ${styles.numberInput}`}
            placeholder="Продажа от"
            value={minSellMoney}
            onChange={(e) =>
              updateParams((p) => {
                if (e.target.value) p.set('minSellMoney', e.target.value)
                else p.delete('minSellMoney')
              })
            }
          />
          <NumberInput
            className={`${styles.input} ${styles.numberInput}`}
            placeholder="Продажа до"
            value={maxSellMoney}
            onChange={(e) =>
              updateParams((p) => {
                if (e.target.value) p.set('maxSellMoney', e.target.value)
                else p.delete('maxSellMoney')
              })
            }
          />
          <NumberInput
            className={`${styles.input} ${styles.numberInput}`}
            placeholder="Скупка от"
            value={minBuyMoney}
            onChange={(e) =>
              updateParams((p) => {
                if (e.target.value) p.set('minBuyMoney', e.target.value)
                else p.delete('minBuyMoney')
              })
            }
          />
          <NumberInput
            className={`${styles.input} ${styles.numberInput}`}
            placeholder="Скупка до"
            value={maxBuyMoney}
            onChange={(e) =>
              updateParams((p) => {
                if (e.target.value) p.set('maxBuyMoney', e.target.value)
                else p.delete('maxBuyMoney')
              })
            }
          />
        </div>
      </div>

      {/* KPI по выдаче */}
      {kpi && (
        <div className={styles.kpiStrip}>
          <div className={styles.kpiItem}>
            🏪 <strong>{formatNumber(kpi.totalShops)}</strong> магазинов
          </div>
          <div className={styles.kpiItem}>
            🟢 <strong>{formatNumber(kpi.activeShops)}</strong> активных
          </div>
          <div className={styles.kpiItem}>
            🧑 <strong>{formatNumber(kpi.uniquePlayers)}</strong> игроков
          </div>
          <div className={styles.kpiItem}>
            <span className={styles.sell}>📈</span>{' '}
            <strong>{formatNumber(kpi.totalSellMoney)}</strong> оборот продажи
          </div>
          <div className={styles.kpiItem}>
            <span className={styles.buy}>📉</span>{' '}
            <strong>{formatNumber(kpi.totalBuyMoney)}</strong> оборот скупки
          </div>
          <div className={styles.kpiItem}>
            📦 <strong>{formatNumber(kpi.totalSellListings)}</strong> / {formatNumber(kpi.totalBuyListings)} лотов
          </div>
        </div>
      )}

      {shops.isLoading && <Spinner />}
      {shops.error && <ErrorMessage message={(shops.error as Error).message} />}

      {shops.data && shops.data.items.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    className={styles.sortable}
                    onClick={() => toggleSort('playerName')}
                  >
                    Игрок{renderSortIcon('playerName')}
                  </th>
                  <th className={styles.sortable} onClick={() => toggleSort('createTime')}>
                    Создан{renderSortIcon('createTime')}
                  </th>
                  <th>Предметы</th>
                  <th
                    className={`${styles.sortable} ${styles.numCell}`}
                    onClick={() => toggleSort('totalItems')}
                  >
                    Лотов (прод/скуп){renderSortIcon('totalItems')}
                  </th>
                  <th
                    className={`${styles.sortable} ${styles.numCell}`}
                    onClick={() => toggleSort('totalSellMoney')}
                  >
                    Продажа{renderSortIcon('totalSellMoney')}
                  </th>
                  <th
                    className={`${styles.sortable} ${styles.numCell}`}
                    onClick={() => toggleSort('totalBuyMoney')}
                  >
                    Скупка{renderSortIcon('totalBuyMoney')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shops.data.items.map((shop) => {
                  const sellLots =
                    shop.sellItemsCount ?? shop.items.filter((i) => i.isSell).length
                  const buyLots =
                    shop.buyItemsCount ?? shop.items.filter((i) => !i.isSell).length
                  return (
                    <tr key={shop.id}>
                      <td>
                        <PlayerTooltip
                          playerId={shop.playerId}
                          server={shop.server || server}
                          cls={shop.player?.cls ?? 0}
                          name={shop.player?.name ?? null}
                          isCaptain={false}
                        >
                          <Link
                            to={`/shops/${server}/${shop.playerId}`}
                            className={styles.playerLink}
                          >
                            {shop.player?.name || `ID: ${shop.playerId}`}
                          </Link>
                        </PlayerTooltip>
                      </td>
                      <td>{formatDate(shop.createTime)}</td>
                      <td>
                        <div className={styles.itemsPreview}>
                          {(hasItemId
                            ? [
                                ...shop.items.filter((i) => i.itemId === hasItemId),
                                ...shop.items.filter((i) => i.itemId !== hasItemId),
                              ]
                            : shop.items
                          ).slice(0, 5).map((item) => (
                            <ItemTooltip
                              key={item.id}
                              name={item.item?.name ?? `#${item.itemId}`}
                              icon={item.item?.icon ?? ''}
                              nameColor={item.item?.nameColor ?? ''}
                              count={item.itemCount}
                              price={item.price}
                            >
                              <Link
                                to={`/items/${item.itemId}`}
                                className={styles.itemIconWrap}
                              >
                                <img
                                  src={item.item?.icon ?? ''}
                                  alt={item.item?.name ?? ''}
                                  className={styles.itemIcon}
                                />
                                {item.itemCount > 1 && (
                                  <span className={styles.itemCountBadge}>
                                    {item.itemCount}
                                  </span>
                                )}
                              </Link>
                            </ItemTooltip>
                          ))}
                          {shop.items.length > 5 && (
                            <Link
                              to={`/shops/${server}/${shop.playerId}`}
                              className={styles.itemsMore}
                            >
                              +{shop.items.length - 5}
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className={styles.numCell}>
                        <span className={styles.sell}>{sellLots}</span>
                        {' / '}
                        <span className={styles.buy}>{buyLots}</span>
                      </td>
                      <td className={`${styles.numCell} ${styles.sell}`}>
                        {formatNumber(shop.totalSellMoney)}
                      </td>
                      <td className={`${styles.numCell} ${styles.buy}`}>
                        {formatNumber(shop.totalBuyMoney)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={shops.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={(p: number) =>
              updateParams((params) => {
                if (p > 1) params.set('page', String(p))
                else params.delete('page')
              }, false)
            }
          />
        </>
      )}

      {shops.data && shops.data.items.length === 0 && (
        <div className={styles.emptyState}>
          Магазины не найдены. Попробуйте изменить фильтры.
        </div>
      )}
    </div>
  )
}
