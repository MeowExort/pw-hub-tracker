import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTeamById, getTeamH2H } from '@/shared/api/teams'
import type { BattleStat, H2HPatternStats } from '@/shared/types/api'
import { getServerName } from '@/shared/utils/format'
import styles from './TeamTooltip.module.scss'

interface TeamTooltipProps {
  teamId: number
  teamName?: string | null
  /** ID текущей команды — для загрузки H2H статистики */
  currentTeamId?: number
  /** ID текущего игрока — фильтр H2H по матчам с участием этого игрока */
  currentPlayerId?: number
  children: React.ReactNode
}

function wrPercent(wins: number, total: number): number {
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'var(--success, #27ae60)'
  if (wr >= 50) return 'var(--warning, #f39c12)'
  return 'var(--danger, #e74c3c)'
}

function StatBlock({ label, icon, stat, memberCount }: { label: string; icon: string; stat: BattleStat; memberCount: number }) {
  const wr = wrPercent(stat.winCount, stat.battleCount)
  const realScore = memberCount > 0 ? Math.round(stat.score / memberCount) : stat.score
  return (
    <div className={styles.statBlock}>
      <div className={styles.statHeader}>
        <span>{icon} {label}</span>
        {stat.rank > 0 && <span className={styles.statRank}>#{stat.rank}</span>}
      </div>
      <div className={styles.statScore}>{realScore}</div>
      <div className={styles.statWr}>
        <div className={styles.wrTrack}>
          <div className={styles.wrFill} style={{ width: `${wr}%`, background: wrColor(wr) }} />
        </div>
        <span className={styles.wrLabel}>{wr}%</span>
      </div>
      <div className={styles.statMeta}>
        {stat.winCount}W / {stat.battleCount} боёв
      </div>
      {stat.weekBattleCount > 0 && (
        <div className={styles.statWeek}>
          Нед: +{stat.weekWinCount}W / {stat.weekBattleCount}б
        </div>
      )}
    </div>
  )
}

function H2HPatternBlock({ stat }: { stat: H2HPatternStats }) {
  const label = stat.matchPattern === 0 ? '⚔ Порядок' : '💀 Хаос'
  const wr = Math.round(stat.winRate)
  const delta = stat.avgScoreChange >= 0 ? `+${stat.avgScoreChange.toFixed(1)}` : stat.avgScoreChange.toFixed(1)
  return (
    <div className={styles.h2hPatternBlock}>
      <div className={styles.h2hPatternHeader}>{label}</div>
      <div className={styles.h2hPatternStats}>
        <span className={styles.h2hScore}>{stat.wins}W : {stat.losses}L</span>
        <span className={styles.h2hWrBadge} style={{ color: wrColor(wr) }}>{wr}%</span>
      </div>
      <div className={styles.h2hPatternMeta}>
        {stat.totalMatches} боёв · Ср.Δ: <span style={{ color: stat.avgScoreChange >= 0 ? 'var(--success, #27ae60)' : 'var(--danger, #e74c3c)' }}>{delta}</span>
      </div>
    </div>
  )
}

export function TeamTooltip({ teamId, teamName, currentTeamId, currentPlayerId, children }: TeamTooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLAnchorElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: team, isLoading } = useQuery({
    queryKey: ['team-tooltip', teamId],
    queryFn: () => getTeamById(teamId, 'battlestats'),
    enabled: hovered,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const { data: h2h, isLoading: h2hLoading } = useQuery({
    queryKey: ['team-h2h', currentTeamId, teamId, currentPlayerId],
    queryFn: () => getTeamH2H(currentTeamId!, teamId, currentPlayerId),
    enabled: hovered && !!currentTeamId && currentTeamId !== teamId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setHovered(true)
    timerRef.current = setTimeout(() => setVisible(true), 300)
  }

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setHovered(false)
    }, 200)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (visible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect()
      if (rect.right > window.innerWidth) {
        tooltipRef.current.style.left = 'auto'
        tooltipRef.current.style.right = '0'
      }
      if (rect.bottom > window.innerHeight) {
        tooltipRef.current.style.top = 'auto'
        tooltipRef.current.style.bottom = '100%'
        tooltipRef.current.style.marginBottom = '8px'
        tooltipRef.current.style.marginTop = '0'
      }
    }
  }, [visible, team, h2h])

  const memberCount = team?.members?.length ?? 0
  const orderStat = team?.battleStats?.find((s) => s.matchPattern === 0)
  const chaosStat = team?.battleStats?.find((s) => s.matchPattern === 1)

  return (
    <div
      className={styles.wrapper}
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible && (
        <Link
          to={`/teams/${teamId}`}
          className={styles.tooltip}
          ref={tooltipRef}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading && (
            <div className={styles.loading}>Загрузка…</div>
          )}
          {team && (
            <>
              <div className={styles.header}>
                <div className={styles.teamIcon}>⚔</div>
                <div className={styles.headerInfo}>
                  <span className={styles.teamName}>
                    {teamName ?? team.name}
                  </span>
                  <span className={styles.teamMeta}>
                    {getServerName(team.zoneId)} · {memberCount} участн.
                  </span>
                </div>
              </div>

              <div className={styles.ratings}>
                {orderStat && <StatBlock label="Порядок" icon="⚔" stat={orderStat} memberCount={memberCount} />}
                {chaosStat && <StatBlock label="Хаос" icon="💀" stat={chaosStat} memberCount={memberCount} />}
                {!orderStat && !chaosStat && (
                  <div className={styles.noStats}>Нет боевой статистики</div>
                )}
              </div>

              {/* H2H секция */}
              {currentTeamId && currentTeamId !== teamId && (
                <div className={styles.h2hSection}>
                  <div className={styles.h2hTitle}>🤝 Личные встречи</div>
                  {h2hLoading && (
                    <div className={styles.h2hLoading}>Загрузка…</div>
                  )}
                  {h2h && h2h.overall.totalMatches === 0 && (
                    <div className={styles.h2hEmpty}>Нет матчей между командами</div>
                  )}
                  {h2h && h2h.overall.totalMatches > 0 && (
                    <>
                      {/* Общий счёт */}
                      <div className={styles.h2hOverall}>
                        <div className={styles.h2hScoreLine}>
                          <span className={styles.h2hWins}>{h2h.overall.wins}</span>
                          <span className={styles.h2hSeparator}>:</span>
                          <span className={styles.h2hLosses}>{h2h.overall.losses}</span>
                        </div>
                        <div className={styles.h2hOverallWr}>
                          <div className={styles.wrTrack}>
                            <div
                              className={styles.wrFill}
                              style={{
                                width: `${Math.round(h2h.overall.winRate)}%`,
                                background: wrColor(Math.round(h2h.overall.winRate)),
                              }}
                            />
                          </div>
                          <span className={styles.wrLabel}>{Math.round(h2h.overall.winRate)}%</span>
                        </div>
                        <div className={styles.h2hOverallMeta}>
                          {h2h.overall.totalMatches} матчей
                        </div>
                      </div>

                      {/* По типам боя */}
                      {h2h.byMatchPattern.length > 0 && (
                        <div className={styles.h2hPatterns}>
                          {h2h.byMatchPattern.map((ps) => (
                            <H2HPatternBlock key={ps.matchPattern} stat={ps} />
                          ))}
                        </div>
                      )}

                      {/* Последние матчи */}
                      {h2h.recentMatches.length > 0 && (
                        <div className={styles.h2hRecent}>
                          <div className={styles.h2hRecentTitle}>Последние встречи</div>
                          {h2h.recentMatches.slice(0, 5).map((m) => {
                            const delta = m.teamScoreAfter - m.teamScoreBefore
                            const deltaStr = delta >= 0 ? `+${delta}` : String(delta)
                            return (
                              <Link
                                key={m.matchId}
                                to={`/matches/${m.matchId}`}
                                className={`${styles.h2hMatchRow} ${m.isWin ? styles.h2hWin : styles.h2hLoss}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className={styles.h2hMatchResult}>{m.isWin ? 'W' : 'L'}</span>
                                <span className={styles.h2hMatchType}>{m.matchPattern === 0 ? '⚔' : '💀'}</span>
                                <span className={styles.h2hMatchDelta} style={{ color: delta >= 0 ? 'var(--success, #27ae60)' : 'var(--danger, #e74c3c)' }}>
                                  {deltaStr}
                                </span>
                                <span className={styles.h2hMatchDate}>
                                  {new Date(m.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                </span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </Link>
      )}
    </div>
  )
}
