import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlayerById, getPlayerMatches, getPlayerScoreHistory } from '@/shared/api/players'
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
import { ScoreChart } from '../TeamDetailPage/ScoreChart'
import { useTeamName, useTeamNames } from '@/shared/hooks/useTeamName'
import styles from './PlayerDetailPage.module.scss'

const PAGE_SIZE = 20

/** Страница деталей игрока */
export function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const id = Number(playerId)
  const [matchPage, setMatchPage] = useState(1)
  const [matchPattern, setMatchPattern] = useState<number | undefined>()

  const playerQuery = useQuery({
    queryKey: ['player', id],
    queryFn: () => getPlayerById(id),
    enabled: !!id,
  })

  const matchesQuery = useQuery({
    queryKey: ['playerMatches', id, { page: matchPage, matchPattern }],
    queryFn: () => getPlayerMatches(id, { page: matchPage, pageSize: PAGE_SIZE, matchPattern }),
    enabled: !!id,
  })

  const historyQuery = useQuery({
    queryKey: ['playerScoreHistory', id, { matchPattern }],
    queryFn: () => getPlayerScoreHistory(id, { matchPattern, limit: 200 }),
    enabled: !!id,
  })

  const matchTeamIds = matchesQuery.data?.items.flatMap((m) => [m.match.teamAId, m.match.teamBId]) ?? []
  const matchTeamNames = useTeamNames(matchTeamIds)
  const playerTeamName = useTeamName(playerQuery.data?.teamId)

  if (playerQuery.isLoading) {
    return <div className={styles.center}><Spinner /></div>
  }

  if (playerQuery.error) {
    return <ErrorMessage message="Не удалось загрузить игрока" onRetry={() => playerQuery.refetch()} />
  }

  const player = playerQuery.data
  if (!player) return null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Игрок #{player.id}</h1>
        <span className={styles.badge}>{getClassName(player.cls)}</span>
      </div>

      <div className={styles.info}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Команда</span>
          <Link to={`/teams/${player.teamId}`}>{playerTeamName ?? player.teamId}</Link>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Последний бой</span>
          <span>{formatTimestamp(player.lastBattleTimestamp)}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Обновлено</span>
          <span>{formatDateTime(player.updatedAt)}</span>
        </div>
      </div>

      {/* Боевая статистика */}
      {player.battleStats.length > 0 && (
        <div className={styles.statsGrid}>
          {player.battleStats.map((stat) => (
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
            </div>
          ))}
        </div>
      )}

      {/* График рейтинга */}
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
                  <th>Результат</th>
                  <th>Δ Рейтинг</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {matchesQuery.data.items.map((m) => (
                  <tr key={m.matchId} className={m.isWinner ? styles.win : styles.loss}>
                    <td>{getMatchPatternName(m.match.matchPattern)}</td>
                    <td><Link to={`/teams/${m.match.teamAId}`}>{matchTeamNames[m.match.teamAId] ?? m.match.teamAId}</Link></td>
                    <td><Link to={`/teams/${m.match.teamBId}`}>{matchTeamNames[m.match.teamBId] ?? m.match.teamBId}</Link></td>
                    <td className={m.isWinner ? styles.winText : styles.lossText}>
                      {m.isWinner ? 'Победа' : 'Поражение'}
                    </td>
                    <td>{formatScoreDelta(m.scoreBefore, m.scoreAfter)}</td>
                    <td className={styles.date}>{formatDateTime(m.match.createdAt)}</td>
                  </tr>
                ))}
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
