import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTeams } from '@/shared/api/teams'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { formatDateTime } from '@/shared/utils/format'
import styles from './TeamsPage.module.scss'

const PAGE_SIZE = 20

/** Страница рейтинга команд */
export function TeamsPage() {
  const [page, setPage] = useState(1)
  const [zoneId, setZoneId] = useState<number | undefined>()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['teams', { page, zoneId }],
    queryFn: () => getTeams({ page, pageSize: PAGE_SIZE, zoneId }),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Рейтинг команд</h1>
        <div className={styles.filters}>
          <select
            className={styles.select}
            value={zoneId ?? ''}
            onChange={(e) => {
              setZoneId(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
          >
            <option value="">Все зоны</option>
            {[1, 2, 3, 4, 5].map((z) => (
              <option key={z} value={z}>Зона {z}</option>
            ))}
          </select>
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
                <th>Зона</th>
                <th>Участники</th>
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
                  <td>{team.zoneId}</td>
                  <td>{team.memberCount}</td>
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
