import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMatchById } from '@/shared/api/matches'
import { getMatchPatternName, getClassIcon, getClassName, formatDateTime } from '@/shared/utils/format'
import type { MatchParticipant } from '@/shared/types/api'
import styles from './MatchTooltip.module.scss'

interface MatchTooltipProps {
  matchId: number
  children: React.ReactNode
}

function formatDelta(before: number | null, after: number | null): string {
  if (before == null || after == null) return '—'
  const d = after - before
  return d >= 0 ? `+${d}` : String(d)
}

function deltaColor(before: number | null, after: number | null): string {
  if (before == null || after == null) return 'var(--text-secondary, #888)'
  const d = after - before
  if (d > 0) return 'var(--success, #27ae60)'
  if (d < 0) return 'var(--danger, #e74c3c)'
  return 'var(--text-secondary, #888)'
}

export function MatchTooltip({ matchId, children }: MatchTooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLAnchorElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + rect.width / 2 + window.scrollX,
    })
  }, [])

  const { data: match, isLoading } = useQuery({
    queryKey: ['match-tooltip', matchId],
    queryFn: () => getMatchById(matchId),
    enabled: hovered,
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
    if (visible) {
      updatePosition()
    }
  }, [visible, updatePosition])

  useEffect(() => {
    if (visible && tooltipRef.current && pos) {
      const rect = tooltipRef.current.getBoundingClientRect()
      if (rect.right > window.innerWidth) {
        tooltipRef.current.style.left = 'auto'
        tooltipRef.current.style.right = `${window.innerWidth - (pos.left + window.scrollX)}px`
      }
      if (rect.bottom > window.innerHeight) {
        const wrapperRect = wrapperRef.current?.getBoundingClientRect()
        if (wrapperRect) {
          tooltipRef.current.style.top = `${wrapperRect.top + window.scrollY - 8}px`
          tooltipRef.current.style.transform = 'translateX(-50%) translateY(-100%)'
        }
      }
    }
  }, [visible, match, pos])

  const teamAParticipants = match?.participants?.filter((p) => p.teamId === match.teamAId) ?? []
  const teamBParticipants = match?.participants?.filter((p) => p.teamId === match.teamBId) ?? []

  const teamAWon = match?.winnerTeamId === match?.teamAId
  const teamBWon = match?.winnerTeamId === match?.teamBId

  return (
    <div
      className={styles.wrapper}
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible && pos && createPortal(
        <Link
          to={`/matches/${matchId}`}
          className={styles.tooltip}
          ref={tooltipRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading && (
            <div className={styles.loading}>Загрузка…</div>
          )}
          {match && (
            <>
              {/* Заголовок */}
              <div className={styles.header}>
                <span className={styles.matchId}>Матч #{match.id}</span>
                <span className={styles.matchType}>
                  {match.matchPattern === 0 ? '⚔' : '💀'} {getMatchPatternName(match.matchPattern)}
                </span>
              </div>

              <div className={styles.date}>{formatDateTime(match.createdAt)}</div>

              {/* Рейтинг команд */}
              <div className={styles.teamsScore}>
                <div className={styles.teamScoreBlock}>
                  <div className={`${styles.teamScoreName} ${teamAWon ? styles.winner : teamBWon ? styles.loser : ''}`}>
                    {match.teamAName ?? `Команда ${match.teamAId}`}
                  </div>
                  <div className={styles.teamScoreRating}>
                    <span>{match.teamAScoreBefore ?? '—'}</span>
                    <span className={styles.arrow}>→</span>
                    <span style={{ color: deltaColor(match.teamAScoreBefore, match.teamAScoreAfter) }}>
                      {match.teamAScoreAfter ?? '—'}
                    </span>
                    <span className={styles.delta} style={{ color: deltaColor(match.teamAScoreBefore, match.teamAScoreAfter) }}>
                      ({formatDelta(match.teamAScoreBefore, match.teamAScoreAfter)})
                    </span>
                  </div>
                </div>
                <div className={styles.vs}>vs</div>
                <div className={styles.teamScoreBlock}>
                  <div className={`${styles.teamScoreName} ${teamBWon ? styles.winner : teamAWon ? styles.loser : ''}`}>
                    {match.teamBName ?? `Команда ${match.teamBId}`}
                  </div>
                  <div className={styles.teamScoreRating}>
                    <span>{match.teamBScoreBefore ?? '—'}</span>
                    <span className={styles.arrow}>→</span>
                    <span style={{ color: deltaColor(match.teamBScoreBefore, match.teamBScoreAfter) }}>
                      {match.teamBScoreAfter ?? '—'}
                    </span>
                    <span className={styles.delta} style={{ color: deltaColor(match.teamBScoreBefore, match.teamBScoreAfter) }}>
                      ({formatDelta(match.teamBScoreBefore, match.teamBScoreAfter)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Участники */}
              {(teamAParticipants.length > 0 || teamBParticipants.length > 0) && (
                <div className={styles.participants}>
                  <TeamParticipants
                    label={match.teamAName ?? `Команда ${match.teamAId}`}
                    participants={teamAParticipants}
                    isWinner={teamAWon}
                  />
                  <TeamParticipants
                    label={match.teamBName ?? `Команда ${match.teamBId}`}
                    participants={teamBParticipants}
                    isWinner={teamBWon}
                  />
                </div>
              )}
            </>
          )}
        </Link>,
        document.body,
      )}
    </div>
  )
}

function TeamParticipants({ label, participants, isWinner }: {
  label: string
  participants: MatchParticipant[]
  isWinner: boolean
}) {
  if (participants.length === 0) return null
  return (
    <div className={styles.teamParticipants}>
      <div className={`${styles.teamLabel} ${isWinner ? styles.winner : styles.loser}`}>
        {isWinner ? '👑 ' : ''}{label}
      </div>
      {participants.map((p) => {
        const delta = formatDelta(p.scoreBefore, p.scoreAfter)
        const color = deltaColor(p.scoreBefore, p.scoreAfter)
        return (
          <div key={p.playerId} className={styles.participant}>
            <img
              src={getClassIcon(p.playerCls)}
              alt={getClassName(p.playerCls)}
              className={styles.participantIcon}
            />
            <span className={styles.participantName}>
              {p.playerName ?? p.playerId}
            </span>
            <span className={styles.participantDelta} style={{ color }}>
              {delta}
            </span>
          </div>
        )
      })}
    </div>
  )
}
