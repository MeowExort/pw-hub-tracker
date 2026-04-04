import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMatches } from '@/shared/api/matches'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { MatchTooltip } from '@/shared/ui/MatchTooltip'
import { TeamTooltip } from '@/shared/ui/TeamTooltip'
import { formatDateTime, getMatchPatternName, formatScoreDelta } from '@/shared/utils/format'
import type { MatchListItem } from '@/shared/types/api'
import styles from './MatchesPage.module.scss'

const PAGE_SIZE = 20
type ViewMode = 'cards' | 'table'
const VIEW_STORAGE_KEY = 'matches-view-mode'

const AUTO_REFRESH_OPTIONS = [
  { label: 'Выкл', value: 0 },
  { label: '5с', value: 5000 },
  { label: '10с', value: 10000 },
  { label: '30с', value: 30000 },
  { label: '1м', value: 60000 },
] as const

function scoreDeltaClass(before: number | null, after: number | null): string {
  if (before == null || after == null) return ''
  return after >= before ? styles.deltaPositive : styles.deltaNegative
}

/** Карточка матча (Вариант 1) */
function MatchCard({ m }: { m: MatchListItem }) {
  const teamAWon = m.winnerTeamId === m.teamAId
  const teamBWon = m.winnerTeamId === m.teamBId
  const teamALabel = m.teamAName ?? `#${m.teamAId}`
  const teamBLabel = m.teamBName ?? `#${m.teamBId}`

  const hasTeamA = m.teamAId != null && m.teamAId !== 0
  const hasTeamB = m.teamBId != null && m.teamBId !== 0
  const teamAScoreAfter = hasTeamA ? Math.trunc((m.teamAScoreAfter ?? 0) / (m.teamAMemberCount ?? 1)) : null
  const teamBScoreAfter = hasTeamB ? Math.trunc((m.teamBScoreAfter ?? 0) / (m.teamBMemberCount ?? 1)) : null
  const teamAScoreBefore = hasTeamA ? Math.trunc((m.teamAScoreBefore ?? 0) / (m.teamAMemberCount ?? 1)) : null
  const teamBScoreBefore = hasTeamB ? Math.trunc((m.teamBScoreBefore ?? 0) / (m.teamBMemberCount ?? 1)) : null

  return (
    <Link to={`/matches/${m.id}`} className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardPattern}>⚔️ {getMatchPatternName(m.matchPattern)}</span>
        <span className={styles.cardDate}>{formatDateTime(m.createdAt)}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.cardTeam} ${teamAWon ? styles.cardWinner : ''}`}>
          <TeamTooltip teamId={m.teamAId} teamName={m.teamAName}>
            <Link to={`/teams/${m.teamAId}`} className={styles.cardTeamName} onClick={(e) => e.stopPropagation()}>
              {teamAWon && '🏆 '}{teamALabel}
            </Link>
          </TeamTooltip>
          <span className={`${styles.cardScore} ${scoreDeltaClass(teamAScoreBefore, teamAScoreAfter)}`}>
            {teamAScoreAfter ?? '—'}{' '}
            <span className={styles.cardDelta}>({formatScoreDelta(teamAScoreBefore, teamAScoreAfter)})</span>
          </span>
        </div>
        <span className={styles.cardVs}>VS</span>
        <div className={`${styles.cardTeam} ${teamBWon ? styles.cardWinner : ''}`}>
          <TeamTooltip teamId={m.teamBId} teamName={m.teamBName}>
            <Link to={`/teams/${m.teamBId}`} className={styles.cardTeamName} onClick={(e) => e.stopPropagation()}>
              {teamBWon && '🏆 '}{teamBLabel}
            </Link>
          </TeamTooltip>
          <span className={`${styles.cardScore} ${scoreDeltaClass(teamBScoreBefore, teamBScoreAfter)}`}>
            {teamBScoreAfter ?? '—'}{' '}
            <span className={styles.cardDelta}>({formatScoreDelta(teamBScoreBefore, teamBScoreAfter)})</span>
          </span>
        </div>
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.cardMore}>Подробнее →</span>
      </div>
    </Link>
  )
}

/** Страница ленты матчей */
export function MatchesPage() {
  const [page, setPage] = useState(1)
  const [matchPattern, setMatchPattern] = useState<number | undefined>()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'cards' || stored === 'table' ? stored : 'table'
  })

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
  }

  const [autoRefresh, setAutoRefresh] = useState(5000)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['matches', { page, matchPattern }],
    queryFn: () => getMatches({ page, pageSize: PAGE_SIZE, matchPattern }),
    refetchInterval: autoRefresh || false,
  })

  const [spinning, setSpinning] = useState(false)
  const wantStop = useRef(false)

  useEffect(() => {
    if (isFetching) {
      wantStop.current = false
      setSpinning(true)
    } else {
      wantStop.current = true
    }
  }, [isFetching])

  const handleAnimationIteration = useCallback(() => {
    if (wantStop.current) {
      setSpinning(false)
    }
  }, [])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        e.preventDefault()
        handleRefresh()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleRefresh])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Матчи</h1>
        <div className={styles.controls}>
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
          <button className={styles.refreshBtn} onClick={handleRefresh} title="Обновить (R)">
            <span className={spinning ? styles.refreshSpin : ''} onAnimationIteration={handleAnimationIteration}>↻</span>
          </button>
          <select
            className={styles.select}
            value={autoRefresh}
            onChange={(e) => setAutoRefresh(Number(e.target.value))}
            title="Автообновление"
          >
            {AUTO_REFRESH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 0 ? '⏸ Авто' : `🔄 ${opt.label}`}
              </option>
            ))}
          </select>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'cards' ? styles.active : ''}`}
              onClick={() => handleViewChange('cards')}
              title="Карточки"
            >
              ▦
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
              onClick={() => handleViewChange('table')}
              title="Таблица"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {isLoading && <div className={styles.center}><Spinner /></div>}
      {error && <ErrorMessage message="Не удалось загрузить матчи" onRetry={() => refetch()} />}

      {data && viewMode === 'table' && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Тип боя</th>
                <th>Счёт А</th>
                <th className={`${styles.teamCol} ${styles.teamColA}`}>Команда А</th>
                <th></th>
                <th className={styles.teamCol}>Команда Б</th>
                <th>Счёт Б</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => {
                const teamAWon = m.winnerTeamId === m.teamAId
                const teamBWon = m.winnerTeamId === m.teamBId
                const teamALabel = m.teamAName ?? (m.teamAId != null ? `#${m.teamAId}` : '—')
                const teamBLabel = m.teamBName ?? (m.teamBId != null ? `#${m.teamBId}` : '—')
                const hasTeamA = m.teamAId != null && m.teamAId !== 0
                const hasTeamB = m.teamBId != null && m.teamBId !== 0
                const teamAScoreAfter = m.teamAScoreAfter ?? 0
                const teamBScoreAfter = m.teamBScoreAfter ?? 0
                const teamAScoreBefore = m.teamAScoreBefore ?? 0
                const teamBScoreBefore = m.teamBScoreBefore ?? 0
                const realTeamAScoreAfter = hasTeamA ? Math.trunc(teamAScoreAfter / (m.teamAMemberCount ?? 1)) : null
                const realTeamBScoreAfter = hasTeamB ? Math.trunc(teamBScoreAfter / (m.teamBMemberCount ?? 1)) : null
                const realTeamAScoreBefore = hasTeamA ? Math.trunc(teamAScoreBefore / (m.teamAMemberCount ?? 1)) : null
                const realTeamBScoreBefore = hasTeamB ? Math.trunc(teamBScoreBefore / (m.teamBMemberCount ?? 1)) : null
                return (
                  <tr key={m.id} className={`${styles.tableRow} ${teamAWon ? styles.rowWinA : styles.rowWinB}`}>
                    <td>
                      <MatchTooltip matchId={m.id}>
                        <Link to={`/matches/${m.id}`} className={styles.matchIdLink}>#{m.id}</Link>
                      </MatchTooltip>
                    </td>
                    <td>
                      <span className={`${styles.patternBadge} ${m.matchPattern === 0 ? styles.patternOrder : styles.patternChaos}`}>
                        {getMatchPatternName(m.matchPattern)}
                      </span>
                    </td>
                    <td className={styles.scoreCell}>
                      {hasTeamA ? (
                        <>
                          <span className={styles.scoreInline}>{realTeamAScoreBefore ?? '-'}{'→'}{realTeamAScoreAfter ?? '—'}</span>
                          {' '}
                          <span className={`${styles.deltaInline} ${scoreDeltaClass(realTeamAScoreBefore, realTeamAScoreAfter)}`}>
                            ({formatScoreDelta(realTeamAScoreBefore, realTeamAScoreAfter)})
                          </span>
                        </>
                      ) : '—'}
                    </td>
                    <td className={`${styles.teamCell} ${styles.teamColA} ${teamAWon ? styles.winner : ''}`}>
                      {hasTeamA ? (
                        <TeamTooltip teamId={m.teamAId} teamName={m.teamAName}>
                          <Link to={`/teams/${m.teamAId}`} className={styles.teamLink}>{teamALabel}</Link>
                        </TeamTooltip>
                      ) : '—'}
                    </td>
                    <td className={styles.vsCell}>vs</td>
                    <td className={`${styles.teamCell} ${teamBWon ? styles.winner : ''}`}>
                      {hasTeamB ? (
                        <TeamTooltip teamId={m.teamBId} teamName={m.teamBName}>
                          <Link to={`/teams/${m.teamBId}`} className={styles.teamLink}>{teamBLabel}</Link>
                        </TeamTooltip>
                      ) : '—'}
                    </td>
                    <td className={styles.scoreCell}>
                      {hasTeamB ? (
                        <>
                          <span className={styles.scoreInline}>{realTeamBScoreBefore ?? '-'}{'→'}{realTeamBScoreAfter ?? '—'}</span>
                          {' '}
                          <span className={`${styles.deltaInline} ${scoreDeltaClass(realTeamBScoreBefore, realTeamBScoreAfter)}`}>
                            ({formatScoreDelta(realTeamBScoreBefore, realTeamBScoreAfter)})
                          </span>
                        </>
                      ) : '—'}
                    </td>
                    <td className={styles.date}>{formatDateTime(m.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}

      {data && viewMode === 'cards' && (
        <>
          {data.items.length === 0 ? (
            <div className={styles.empty}>Матчи не найдены</div>
          ) : (
            <div className={styles.cardsList}>
              {data.items.map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          )}
          <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
