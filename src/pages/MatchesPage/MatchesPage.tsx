import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMatches } from '@/shared/api/matches'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { formatDateTime, getMatchPatternName, formatScoreDelta } from '@/shared/utils/format'
import styles from './MatchesPage.module.scss'

const PAGE_SIZE = 20

/** Страница ленты матчей */
export function MatchesPage() {
  const [page, setPage] = useState(1)
  const [matchPattern, setMatchPattern] = useState<number | undefined>()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['matches', { page, matchPattern }],
    queryFn: () => getMatches({ page, pageSize: PAGE_SIZE, matchPattern }),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Матчи</h1>
        <select
          className={styles.select}
          value={matchPattern ?? ''}
          onChange={(e) => {
            setMatchPattern(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
        >
          <option value="">Все типы</option>
          <option value="0">Порядок</option>
          <option value="1">Хаос</option>
        </select>
      </div>

      {isLoading && <div className={styles.center}><Spinner /></div>}
      {error && <ErrorMessage message="Не удалось загрузить матчи" onRetry={() => refetch()} />}

      {data && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Тип боя</th>
                <th>Команда A</th>
                <th>Команда B</th>
                <th>Δ A</th>
                <th>Δ B</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td><Link to={`/matches/${m.id}`}>#{m.id}</Link></td>
                  <td>{getMatchPatternName(m.matchPattern)}</td>
                  <td>
                    <Link
                      to={`/teams/${m.teamAId}`}
                      className={m.winnerTeamId === m.teamAId ? styles.winner : ''}
                    >
                      {m.teamAName ?? m.teamAId}
                    </Link>
                  </td>
                  <td>
                    <Link
                      to={`/teams/${m.teamBId}`}
                      className={m.winnerTeamId === m.teamBId ? styles.winner : ''}
                    >
                      {m.teamBName ?? m.teamBId}
                    </Link>
                  </td>
                  <td>{formatScoreDelta(m.teamAScoreBefore, m.teamAScoreAfter)}</td>
                  <td>{formatScoreDelta(m.teamBScoreBefore, m.teamBScoreAfter)}</td>
                  <td className={styles.date}>{formatDateTime(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
