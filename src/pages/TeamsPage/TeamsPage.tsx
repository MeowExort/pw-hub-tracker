import { useState, useDeferredValue, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getTeams, searchTeams } from '@/shared/api/teams'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { formatDateTime, getServerName } from '@/shared/utils/format'
import styles from './TeamsPage.module.scss'

const PAGE_SIZE = 20
const SORT_STORAGE_KEY = 'teams_sortBy'

type SortBy = '' | 'ratingOrder' | 'ratingChaos'

function isValidSort(v: string | null): v is SortBy {
  return v === '' || v === 'ratingOrder' || v === 'ratingChaos'
}

/** Страница рейтинга команд */
export function TeamsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [zoneId, setZoneId] = useState<number | undefined>()

  // Инициализация sortBy: URL > localStorage > default
  const urlSort = searchParams.get('sortBy')
  const initialSort = (): SortBy => {
    if (isValidSort(urlSort)) return urlSort
    const stored = localStorage.getItem(SORT_STORAGE_KEY)
    if (stored && isValidSort(stored)) return stored
    return 'ratingChaos'
  }
  const [sortBy, setSortByState] = useState<SortBy>(initialSort)

  // Синхронизация sortBy в URL при первом рендере (если взяли из localStorage)
  useEffect(() => {
    if (!isValidSort(urlSort) || urlSort !== sortBy) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (sortBy) next.set('sortBy', sortBy)
        else next.delete('sortBy')
        return next
      }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setSortBy = (value: SortBy) => {
    setSortByState(value)
    localStorage.setItem(SORT_STORAGE_KEY, value)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set('sortBy', value)
      else next.delete('sortBy')
      return next
    }, { replace: true })
  }
  const [searchInput, setSearchInput] = useState('')
  const deferredSearch = useDeferredValue(searchInput.trim())

  const isSearchMode = deferredSearch.length > 0

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: isSearchMode
      ? ['teams-search', { name: deferredSearch, page, zoneId }]
      : ['teams', { page, zoneId, sortBy }],
    queryFn: () =>
      isSearchMode
        ? searchTeams({ name: deferredSearch, page, pageSize: PAGE_SIZE, zoneId })
        : getTeams({
            page,
            pageSize: PAGE_SIZE,
            zoneId,
            sortBy: sortBy || undefined,
          }),
  })


  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Рейтинг команд</h1>
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Поиск по названию…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setPage(1)
            }}
          />
          <select
            className={styles.select}
            value={zoneId ?? ''}
            onChange={(e) => {
              setZoneId(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
          >
            <option value="">Все сервера</option>
            {[2, 3, 5, 29].map((z) => (
              <option key={z} value={z}>{getServerName(z)}</option>
            ))}
          </select>
          {!isSearchMode && (
            <select
              className={styles.select}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortBy)
                setPage(1)
              }}
            >
              <option value="">По обновлению</option>
              <option value="ratingOrder">Рейтинг (Порядок)</option>
              <option value="ratingChaos">Рейтинг (Хаос)</option>
            </select>
          )}
        </div>
      </div>

      {isLoading && (
        <div className={styles.center}><Spinner /></div>
      )}

      {error && (
        <ErrorMessage message="Не удалось загрузить команды" onRetry={() => refetch()} />
      )}

      {data && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Сервер</th>
                <th>Участники</th>
                <th>Рейтинг (Порядок)</th>
                <th>Рейтинг (Хаос)</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((team) => (
                <tr key={team.id}>
                  <td>
                    <Link to={`/teams/${team.id}`} className={styles.teamLink}>
                      {team.name}
                    </Link>
                  </td>
                  <td>{getServerName(team.zoneId)}</td>
                  <td>{team.memberCount}</td>
                  <td>{team.ratingOrder != null ? Math.trunc(team.ratingOrder) : '—'}</td>
                  <td>{team.ratingChaos != null ? Math.trunc(team.ratingChaos) : '—'}</td>
                  <td className={styles.date}>{formatDateTime(team.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
