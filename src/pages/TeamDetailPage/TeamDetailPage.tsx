import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getTeamById, getTeamMembers, getTeamMatches, getTeamScoreHistory } from '@/shared/api/teams'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import {
  formatDateTime,
  formatTimestamp,
  getClassName,
  getMatchPatternName,
  calcWinRate,
  formatScoreDelta,
} from '@/shared/utils/format'
import { ScoreChart } from './ScoreChart'
import { useTeamNames } from '@/shared/hooks/useTeamName'
import styles from './TeamDetailPage.module.scss'

const PAGE_SIZE = 20

/** Страница деталей команды */
export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const id = Number(teamId)
  const [matchPage, setMatchPage] = useState(1)
  const [matchPattern, setMatchPattern] = useState<number | undefined>()

  const teamQuery = useQuery({
    queryKey: ['team', id],
    queryFn: () => getTeamById(id),
    enabled: !!id,
  })

  const membersQuery = useQuery({
    queryKey: ['teamMembers', id],
    queryFn: () => getTeamMembers(id),
    enabled: !!id,
  })

  const matchesQuery = useQuery({
    queryKey: ['teamMatches', id, { page: matchPage, matchPattern }],
    queryFn: () => getTeamMatches(id, { page: matchPage, pageSize: PAGE_SIZE, matchPattern }),
    enabled: !!id,
  })

  const historyQuery = useQuery({
    queryKey: ['teamScoreHistory', id, { matchPattern }],
    queryFn: () => getTeamScoreHistory(id, { matchPattern, limit: 200 }),
    enabled: !!id,
  })

  const matchTeamIds = matchesQuery.data?.items.flatMap((m) => [m.teamAId, m.teamBId]) ?? []
  const matchTeamNames = useTeamNames(matchTeamIds)

  if (teamQuery.isLoading) {
    return <div className={styles.center}><Spinner /></div>
  }

  if (teamQuery.error) {
    return <ErrorMessage message="Не удалось загрузить команду" onRetry={() => teamQuery.refetch()} />
  }

  const team = teamQuery.data
  if (!team) return null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{team.name}</h1>
        <span className={styles.zone}>Зона {team.zoneId}</span>
      </div>

      {/* Боевая статистика */}
      {team.battleStats.length > 0 && (
        <div className={styles.statsGrid}>
          {team.battleStats.map((stat) => (
            <div key={stat.matchPattern} className={styles.statCard}>
              <div className={styles.statHeader}>{getMatchPatternName(stat.matchPattern)}</div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Рейтинг</span>
                <span className={styles.statValue}>{stat.score}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Ранг</span>
                <span className={styles.statValue}>#{stat.rank}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Винрейт</span>
                <span className={styles.statValue}>{calcWinRate(stat.winCount, stat.battleCount)}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Бои</span>
                <span className={styles.statValue}>{stat.battleCount}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>За неделю</span>
                <span className={styles.statValue}>
                  {stat.weekBattleCount} ({stat.weekWinCount}W)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Фильтр типа боя */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>График рейтинга</h2>
          <select
            className={styles.select}
            value={matchPattern ?? ''}
            onChange={(e) => {
              setMatchPattern(e.target.value ? Number(e.target.value) : undefined)
              setMatchPage(1)
            }}
          >
            <option value="">Все типы</option>
            <option value="0">Порядок</option>
            <option value="1">Хаос</option>
          </select>
        </div>
        {historyQuery.isLoading && <div className={styles.center}><Spinner size="sm" /></div>}
        {historyQuery.data && historyQuery.data.length > 0 && (
          <ScoreChart data={historyQuery.data} />
        )}
        {historyQuery.data && historyQuery.data.length === 0 && (
          <p className={styles.empty}>Нет данных истории рейтинга</p>
        )}
      </div>

      {/* Участники */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Участники</h2>
        {membersQuery.isLoading && <div className={styles.center}><Spinner size="sm" /></div>}
        {membersQuery.data && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Класс</th>
                <th>Последний бой</th>
              </tr>
            </thead>
            <tbody>
              {membersQuery.data.map((m) => (
                <tr key={m.playerId}>
                  <td>
                    <Link to={`/players/${m.playerId}`}>{m.playerId}</Link>
                  </td>
                  <td>{getClassName(m.player.cls)}</td>
                  <td className={styles.date}>{formatTimestamp(m.player.lastBattleTimestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Матчи */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Матчи</h2>
        {matchesQuery.isLoading && <div className={styles.center}><Spinner size="sm" /></div>}
        {matchesQuery.data && (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Тип боя</th>
                  <th>Команда A</th>
                  <th>Команда B</th>
                  <th>Δ Рейтинг</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {matchesQuery.data.items.map((match) => {
                  const isTeamA = match.teamAId === id
                  const won = match.winnerTeamId === id
                  return (
                    <tr key={match.id} className={won ? styles.win : match.winnerTeamId ? styles.loss : ''}>
                      <td>{getMatchPatternName(match.matchPattern)}</td>
                      <td>
                        <Link to={`/teams/${match.teamAId}`}>{matchTeamNames[match.teamAId] ?? match.teamAId}</Link>
                      </td>
                      <td>
                        <Link to={`/teams/${match.teamBId}`}>{matchTeamNames[match.teamBId] ?? match.teamBId}</Link>
                      </td>
                      <td>
                        {isTeamA
                          ? formatScoreDelta(match.teamAScoreBefore, match.teamAScoreAfter)
                          : formatScoreDelta(match.teamBScoreBefore, match.teamBScoreAfter)}
                      </td>
                      <td className={styles.date}>{formatDateTime(match.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination
              page={matchPage}
              total={matchesQuery.data.total}
              pageSize={PAGE_SIZE}
              onPageChange={setMatchPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
