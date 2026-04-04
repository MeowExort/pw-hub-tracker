import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMatchById } from '@/shared/api/matches'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import {
  formatDateTime,
  getMatchPatternName,
  getClassName,
  getClassIcon,
  formatScoreDelta,
  formatPlayerName,
} from '@/shared/utils/format'
import { PlayerTooltip } from '@/shared/ui/PlayerTooltip'
import { TeamTooltip } from '@/shared/ui/TeamTooltip'
import styles from './MatchDetailPage.module.scss'

/** Страница деталей матча */
export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const id = Number(matchId)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['match', id],
    queryFn: () => getMatchById(id),
    enabled: !!id,
  })

  if (isLoading) return <div className={styles.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить матч" onRetry={() => refetch()} />
  if (!data) return null

  const teamALabel = data.teamAName ?? `Команда ${data.teamAId}`
  const teamBLabel = data.teamBName ?? `Команда ${data.teamBId}`

  const teamAParticipants = data.participants.filter((p) => p.teamId === data.teamAId)
  const teamBParticipants = data.participants.filter((p) => p.teamId === data.teamBId)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        Матч #{data.id} — {getMatchPatternName(data.matchPattern)}
      </h1>
      <p className={styles.date}>{formatDateTime(data.createdAt)}</p>

      <div className={styles.versus}>
        <div className={`${styles.team} ${data.winnerTeamId === data.teamAId ? styles.winner : ''}`}>
          <TeamTooltip teamId={data.teamAId} teamName={data.teamAName}>
            <Link to={`/teams/${data.teamAId}`} className={styles.teamName}>
              {teamALabel}
            </Link>
          </TeamTooltip>
          <div className={styles.score}>
            {data.teamAScoreAfter ?? '—'}
            <span className={styles.delta}>
              ({formatScoreDelta(data.teamAScoreBefore, data.teamAScoreAfter)})
            </span>
          </div>
        </div>
        <span className={styles.vs}>VS</span>
        <div className={`${styles.team} ${data.winnerTeamId === data.teamBId ? styles.winner : ''}`}>
          <TeamTooltip teamId={data.teamBId} teamName={data.teamBName}>
            <Link to={`/teams/${data.teamBId}`} className={styles.teamName}>
              {teamBLabel}
            </Link>
          </TeamTooltip>
          <div className={styles.score}>
            {data.teamBScoreAfter ?? '—'}
            <span className={styles.delta}>
              ({formatScoreDelta(data.teamBScoreBefore, data.teamBScoreAfter)})
            </span>
          </div>
        </div>
      </div>

      <div className={styles.participants}>
        <div className={styles.side}>
          <h3 className={styles.sideTitle}>{teamALabel}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Игрок</th>
                <th>Δ Рейтинг</th>
              </tr>
            </thead>
            <tbody>
              {teamAParticipants.map((p) => (
                <tr key={p.playerId} className={p.isWinner ? styles.winRow : styles.lossRow}>
                  <td className={styles.idCell}>
                    <PlayerTooltip playerId={p.playerId} server={p.playerServer ?? 'unknown'} cls={p.playerCls} name={p.playerName}>
                      <Link to={`/players/${p.playerServer ?? 'unknown'}/${p.playerId}`}>
                        <img src={getClassIcon(p.playerCls)} alt={getClassName(p.playerCls)} className={styles.classIcon} />
                        {formatPlayerName(p.playerId, p.playerName)}
                      </Link>
                    </PlayerTooltip>
                  </td>
                  <td>{formatScoreDelta(p.scoreBefore, p.scoreAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.side}>
          <h3 className={styles.sideTitle}>{teamBLabel}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Игрок</th>
                <th>Δ Рейтинг</th>
              </tr>
            </thead>
            <tbody>
              {teamBParticipants.map((p) => (
                <tr key={p.playerId} className={p.isWinner ? styles.winRow : styles.lossRow}>
                  <td className={styles.idCell}>
                    <PlayerTooltip playerId={p.playerId} server={p.playerServer ?? 'unknown'} cls={p.playerCls} name={p.playerName}>
                      <Link to={`/players/${p.playerServer ?? 'unknown'}/${p.playerId}`}>
                        <img src={getClassIcon(p.playerCls)} alt={getClassName(p.playerCls)} className={styles.classIcon} />
                        {formatPlayerName(p.playerId, p.playerName)}
                      </Link>
                    </PlayerTooltip>
                  </td>
                  <td>{formatScoreDelta(p.scoreBefore, p.scoreAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
