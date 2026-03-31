import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlayerById, getPlayerMatches, getPlayerScoreHistory, getPlayerPropertiesByIds } from '@/shared/api/players'
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
  formatPlayerName,
} from '@/shared/utils/format'
import { ScoreChart } from '../TeamDetailPage/ScoreChart'
import { useTeamName, useTeamNames } from '@/shared/hooks/useTeamName'
import styles from './PlayerDetailPage.module.scss'

const PAGE_SIZE = 20

/** Страница деталей игрока */
export function PlayerDetailPage() {
  const { server, playerId } = useParams<{ server: string; playerId: string }>()
  const id = Number(playerId)
  const [matchPage, setMatchPage] = useState(1)
  const [matchPattern, setMatchPattern] = useState<number | undefined>()

  const playerQuery = useQuery({
    queryKey: ['player', server, id],
    queryFn: () => getPlayerById(server!, id),
    enabled: !!server && !!id,
  })

  const matchesQuery = useQuery({
    queryKey: ['playerMatches', server, id, { page: matchPage, matchPattern }],
    queryFn: () => getPlayerMatches(server!, id, { page: matchPage, pageSize: PAGE_SIZE, matchPattern }),
    enabled: !!server && !!id,
  })

  const historyQuery = useQuery({
    queryKey: ['playerScoreHistory', server, id, { matchPattern }],
    queryFn: () => getPlayerScoreHistory(server!, id, { matchPattern, limit: 200 }),
    enabled: !!server && !!id,
  })

  const propsQuery = useQuery({
    queryKey: ['playerProperties', server, id],
    queryFn: () => getPlayerPropertiesByIds([{ Id: id, Server: server! }]),
    enabled: !!server && !!id,
  })

  const props = propsQuery.data?.[0]

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
        <h1 className={styles.title}>{formatPlayerName(player.id, player.name)}</h1>
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

      {/* Боевая статистика + Характеристики */}
      <div className={styles.ratingAndProps}>
        {player.battleStats.length > 0 && (
          <div className={styles.ratingCol}>
            <h2 className={styles.sectionTitle}>Текущий рейтинг</h2>
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
          </div>
        )}

        <div className={styles.propsCol}>
          <h2 className={styles.sectionTitle}>Характеристики</h2>
          {propsQuery.isLoading && <div className={styles.center}><Spinner size="sm" /></div>}
          {props && (
            <div className={styles.propsTooltip}>
            <div className={styles.propsTooltipHeader}>
              <span className={styles.propsTooltipIcon}>❤️</span>
              <span className={styles.propsHp}>{props.hp.toLocaleString()}</span>
              <span className={styles.propsTooltipIcon}>💧</span>
              <span className={styles.propsMp}>{props.mp.toLocaleString()}</span>
            </div>
            <div className={styles.propsTooltipBody}>
              <div className={styles.propsInnerCol}>
                <div className={styles.propRow}><span className={styles.propLabel}>ПА</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.attackDegree}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>ПЗ</span><span className={`${styles.propValue} ${styles.defColor}`}>{props.defendDegree}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>БУ</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.peakGrade}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>БД</span><span className={styles.propValue}>{props.vigour}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>Физ. атака</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.damageLow} – {props.damageHigh}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>Маг. атака</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.damageMagicLow} – {props.damageMagicHigh}</span></div>
              </div>
              <div className={styles.propsInnerCol}>
                <div className={styles.propRow}><span className={styles.propLabel}>Крит. урон</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.critDamageBonus.toLocaleString()}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>Крит. шанс</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.critRate.toLocaleString()}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>Физ. защита</span><span className={`${styles.propValue} ${styles.defColor}`}>{props.defense.toLocaleString()}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>Маг. защита</span><span className={`${styles.propValue} ${styles.defColor}`}>{props.resistance[0].toLocaleString()}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>Пробив. физ.</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.antiDefenseDegree}</span></div>
                <div className={styles.propRow}><span className={styles.propLabel}>Пробив. маг.</span><span className={`${styles.propValue} ${styles.atkColor}`}>{props.antiResistanceDegree}</span></div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

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
                  <th>#ID</th>
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
                    <td><Link to={`/matches/${m.matchId}`}>#{m.matchId}</Link></td>
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
