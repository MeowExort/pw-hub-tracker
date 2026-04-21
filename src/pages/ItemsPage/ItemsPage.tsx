import { useState, useEffect } from 'react'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { getItems, type GetItemsParams } from '@/shared/api/pshop'
import { usePShopServer } from '@/shared/hooks/usePShopServer'
import { ServerSelector } from '@/shared/ui/ServerSelector'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { ItemTooltip } from '@/shared/ui/ItemTooltip'
import { formatNumber } from '@/shared/utils/pshop'
import { notifyTextInput } from '@/shared/security/behavior-tracker'
import styles from './ItemsPage.module.scss'

const PAGE_SIZE = 15

export function ItemsPage() {
  const [server, setServer] = usePShopServer()
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const deferredSearch = useDebouncedValue(searchInput.trim())

  const page = parseInt(searchParams.get('page') || '1', 10)
  const sortBy = (searchParams.get('sortBy') as GetItemsParams['sortBy']) || 'name'
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
  const isSell = searchParams.get('isSell') === 'false' ? false : true
  
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams)
    if (deferredSearch) newParams.set('search', deferredSearch)
    else newParams.delete('search')
    
    if (page > 1) newParams.set('page', page.toString())
    else newParams.delete('page')

    setSearchParams(newParams, { replace: true })
  }, [deferredSearch])

  const { data, isLoading, error } = useQuery({
    queryKey: ['items-search', server, deferredSearch, page, sortBy, sortOrder, isSell, minPrice, maxPrice],
    queryFn: () => getItems({
      server,
      search: deferredSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortOrder,
      isSell,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      // B4: sparkline приходит вместе с листингом — ItemTooltip не делает N отдельных запросов.
      withSparkline: true,
      sparklineDays: 30,
      sparklinePoints: 24,
    }),
  })

  const handleSort = (key: GetItemsParams['sortBy'], sell: boolean) => {
    const newParams = new URLSearchParams(searchParams)
    if (sortBy === key && isSell === sell) {
      newParams.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      newParams.set('sortBy', key!)
      newParams.set('isSell', String(sell))
      newParams.set('sortOrder', 'desc')
    }
    setSearchParams(newParams)
  }

  const renderSortIndicator = (key: GetItemsParams['sortBy'], sell: boolean) => {
    if (sortBy !== key || isSell !== sell) return null
    return sortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Поиск предметов</h1>
        <ServerSelector value={server} onChange={setServer} />
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Поиск предметов..."
            value={searchInput}
            onChange={(e) => { notifyTextInput(searchInput.length, e.target.value.length); setSearchInput(e.target.value) }}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.priceFilters}>
          <input
            type="number"
            placeholder="Мин. цена"
            value={minPrice}
            onChange={(e) => {
              const p = new URLSearchParams(searchParams)
              if (e.target.value) p.set('minPrice', e.target.value)
              else p.delete('minPrice')
              setSearchParams(p)
            }}
          />
          <input
            type="number"
            placeholder="Макс. цена"
            value={maxPrice}
            onChange={(e) => {
              const p = new URLSearchParams(searchParams)
              if (e.target.value) p.set('maxPrice', e.target.value)
              else p.delete('maxPrice')
              setSearchParams(p)
            }}
          />
        </div>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorMessage message={(error as Error).message} />}

      {data && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('name', true)}>Предмет {renderSortIndicator('name', true)}</th>
                  <th colSpan={3} className={styles.groupHeader}>Продажа</th>
                  <th colSpan={3} className={styles.groupHeader}>Скупка</th>
                </tr>
                <tr>
                  <th></th>
                  <th onClick={() => handleSort('minPrice', true)}>Мин {renderSortIndicator('minPrice', true)}</th>
                  <th onClick={() => handleSort('maxPrice', true)}>Макс {renderSortIndicator('maxPrice', true)}</th>
                  <th onClick={() => handleSort('medianPrice', true)}>Медиана {renderSortIndicator('medianPrice', true)}</th>
                  <th onClick={() => handleSort('minPrice', false)}>Мин {renderSortIndicator('minPrice', false)}</th>
                  <th onClick={() => handleSort('maxPrice', false)}>Макс {renderSortIndicator('maxPrice', false)}</th>
                  <th onClick={() => handleSort('medianPrice', false)}>Медиана {renderSortIndicator('medianPrice', false)}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className={styles.row}>
                    <td>
                      <ItemTooltip
                        itemId={item.id}
                        server={server}
                        name={item.name}
                        icon={item.icon ?? ''}
                        sparkline={item.sparkline}
                      >
                        <Link to={`/items/${item.id}`} className={styles.itemLink}>
                          <img src={item.icon ?? ''} alt="" className={styles.itemIcon} />
                          <span>{item.name}</span>
                        </Link>
                      </ItemTooltip>
                    </td>
                    <td className={styles.price}>{formatNumber(item.sell?.min)}</td>
                    <td className={styles.price}>{formatNumber(item.sell?.max)}</td>
                    <td className={styles.price}>{formatNumber(item.sell?.median)}</td>
                    <td className={styles.price}>{formatNumber(item.buy?.min)}</td>
                    <td className={styles.price}>{formatNumber(item.buy?.max)}</td>
                    <td className={styles.price}>{formatNumber(item.buy?.median)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={(p: number) => {
              const next = new URLSearchParams(searchParams)
              next.set('page', p.toString())
              setSearchParams(next)
            }}
          />
        </>
      )}
    </div>
  )
}
