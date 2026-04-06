import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMatchById } from '@/shared/api/matches'
import { getTeamH2H } from '@/shared/api/teams'
import { getPlayerPropertiesByIds } from '@/shared/api/players'
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
import { MatchTooltip } from '@/shared/ui/MatchTooltip'
import type { MatchParticipant, PlayerDetailProperties } from '@/shared/types/api'
import styles from './MatchDetailPage.module.scss'

/** Суммарные характеристики команды */
interface TeamStats {
  attackDegree: number
  defendDegree: number
  vigour: number
  peakGrade: number
}

/** Суммировать характеристики участников команды */
function sumTeamStats(participants: MatchParticipant[], propsMap: Map<number, PlayerDetailProperties>): TeamStats {
  let attackDegree = 0, defendDegree = 0, vigour = 0, peakGrade = 0
  for (const p of participants) {
    const props = propsMap.get(p.playerId)
    if (props) {
      attackDegree += props.attackDegree
      defendDegree += props.defendDegree
      vigour += props.vigour
      peakGrade += props.peakGrade
    }
  }
  return { attackDegree, defendDegree, vigour, peakGrade }
}

/** Рассчитать вероятность победы команды A */
function calculateWinProbability(
  teamAStats: TeamStats | null,
  teamBStats: TeamStats | null,
  h2hWinRate: number,
  h2hMatchCount: number,
): number {
  const hasStrength = teamAStats && teamBStats

  if (!hasStrength) {
    // Только история встреч
    if (h2hMatchCount === 0) return 0.5
    return h2hWinRate / 100
  }

  // Сила команды — взвешенная сумма характеристик
  const strengthA = teamAStats.attackDegree * 0.3
    + teamAStats.defendDegree * 0.25
    + teamAStats.vigour * 0.2
    + teamAStats.peakGrade * 0.25

  const strengthB = teamBStats.attackDegree * 0.3
    + teamBStats.defendDegree * 0.25
    + teamBStats.vigour * 0.2
    + teamBStats.peakGrade * 0.25

  // Компонент силы (логистическая функция)
  const strengthDiff = strengthA - strengthB
  const strengthProb = 1 / (1 + Math.exp(-strengthDiff * 0.01))

  if (h2hMatchCount === 0) return strengthProb

  // Компонент истории встреч
  const h2hProb = h2hWinRate / 100

  // Вес истории зависит от количества матчей
  const h2hWeight = Math.min(h2hMatchCount / 20, 0.5)
  const strengthWeight = 1 - h2hWeight

  return strengthProb * strengthWeight + h2hProb * h2hWeight
}

/** Страница деталей матча — Sidebar + Content */
export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const id = Number(matchId)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['match', id],
    queryFn: () => getMatchById(id),
    enabled: !!id,
  })

  // H2H запрос
  const h2hQuery = useQuery({
    queryKey: ['h2h', data?.teamAId, data?.teamBId],
    queryFn: () => getTeamH2H(data!.teamAId, data!.teamBId),
    enabled: !!data,
  })

  // Хаос = matchPattern 1
  const isChaos = data?.matchPattern === 1

  // Характеристики игроков (только для Хаоса)
  const allPlayers = data?.participants.map(p => ({
    Id: p.playerId,
    Server: p.playerServer ?? 'unknown',
  })) ?? []

  const propsQuery = useQuery({
    queryKey: ['matchPlayerProps', id],
    queryFn: () => getPlayerPropertiesByIds(allPlayers),
    enabled: isChaos && allPlayers.length > 0,
  })

  if (isLoading) return <div className={styles.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить матч" onRetry={() => refetch()} />
  if (!data) return null

  const teamALabel = data.teamAName ?? `Команда ${data.teamAId}`
  const teamBLabel = data.teamBName ?? `Команда ${data.teamBId}`

  const teamAParticipants = data.participants.filter((p) => p.teamId === data.teamAId)
  const teamBParticipants = data.participants.filter((p) => p.teamId === data.teamBId)

  // Карта характеристик
  const propsMap = new Map<number, PlayerDetailProperties>()
  if (propsQuery.data) {
    for (const p of propsQuery.data) {
      propsMap.set(p.playerId, p)
    }
  }

  const teamAStats = isChaos && propsMap.size > 0 ? sumTeamStats(teamAParticipants, propsMap) : null
  const teamBStats = isChaos && propsMap.size > 0 ? sumTeamStats(teamBParticipants, propsMap) : null

  // Предикт
  const h2h = h2hQuery.data
  const h2hWinRate = h2h?.overall.winRate ?? 50
  const h2hMatchCount = h2h?.overall.totalMatches ?? 0
  const winProbA = calculateWinProbability(
    teamAStats,
    teamBStats,
    h2hWinRate,
    h2hMatchCount,
  )
  const winProbB = 1 - winProbA

  const predictBasis = isChaos && teamAStats
    ? `сила команд${h2h && h2hMatchCount > 0 ? ` + ${h2hMatchCount} встреч` : ''}`
    : h2hMatchCount > 0
      ? `${h2hMatchCount} встреч`
      : 'нет данных'

  // Детали предикта для тултипа
  const hasStrength = !!(teamAStats && teamBStats)
  const strengthA = teamAStats
    ? teamAStats.attackDegree * 0.3 + teamAStats.defendDegree * 0.25 + teamAStats.vigour * 0.2 + teamAStats.peakGrade * 0.25
    : 0
  const strengthB = teamBStats
    ? teamBStats.attackDegree * 0.3 + teamBStats.defendDegree * 0.25 + teamBStats.vigour * 0.2 + teamBStats.peakGrade * 0.25
    : 0
  const strengthDiff = strengthA - strengthB
  const strengthProb = hasStrength ? 1 / (1 + Math.exp(-strengthDiff * 0.01)) : null
  const h2hProb = h2hWinRate / 100
  const h2hWeight = hasStrength ? Math.min(h2hMatchCount / 20, 0.5) : (h2hMatchCount > 0 ? 1 : 0)
  const strengthWeight = 1 - h2hWeight

  // Характеристики для сравнения
  const STATS_LABELS: { key: keyof TeamStats; label: string }[] = [
    { key: 'attackDegree', label: 'ПА' },
    { key: 'defendDegree', label: 'ПЗ' },
    { key: 'vigour', label: 'БД' },
    { key: 'peakGrade', label: 'БУ' },
  ]

  return (
    <div className={styles.layout}>
      {/* ===== SIDEBAR ===== */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.matchTitle}>Матч #{data.id}</h1>
          <span className={styles.badge}>{getMatchPatternName(data.matchPattern)}</span>
          <span className={styles.matchDate}>{formatDateTime(data.createdAt)}</span>
        </div>

        {/* Результат */}
        <div className={styles.sideResult}>
          <div className={styles.sideSectionLabel}>Результат</div>
          <div className={styles.sideTeamRow}>
            <span className={styles.sideTeamName}>
              {data.winnerTeamId === data.teamAId && <span className={styles.winnerIcon}>🏆</span>}
              <TeamTooltip teamId={data.teamAId} teamName={data.teamAName}>
                <Link to={`/teams/${data.teamAId}`}>{teamALabel}</Link>
              </TeamTooltip>
            </span>
            <span className={styles.sideTeamScore}>
              {teamAParticipants[0]?.scoreAfter ?? '—'}
              <span className={styles.sideDelta}>({formatScoreDelta(teamAParticipants[0]?.scoreBefore ?? null, teamAParticipants[0]?.scoreAfter ?? null)})</span>
            </span>
          </div>
          <div className={styles.sideVs}>VS</div>
          <div className={styles.sideTeamRow}>
            <span className={styles.sideTeamName}>
              {data.winnerTeamId === data.teamBId && <span className={styles.winnerIcon}>🏆</span>}
              <TeamTooltip teamId={data.teamBId} teamName={data.teamBName}>
                <Link to={`/teams/${data.teamBId}`}>{teamBLabel}</Link>
              </TeamTooltip>
            </span>
            <span className={styles.sideTeamScore}>
              {teamBParticipants[0]?.scoreAfter ?? '—'}
              <span className={styles.sideDelta}>({formatScoreDelta(teamBParticipants[0]?.scoreBefore ?? null, teamBParticipants[0]?.scoreAfter ?? null)})</span>
            </span>
          </div>
        </div>

        {/* Предикт */}
        <div className={styles.sidePredict}>
          <div className={styles.sideSectionLabel}>
            Предикт
            <span className={styles.predictInfoWrap}>
              <span className={styles.predictInfoIcon}>i</span>
              <div className={styles.predictTooltip}>
                <div className={styles.predictTooltipTitle}>Алгоритм расчёта предикта</div>
                <div className={styles.predictTooltipText}>
                  Вероятность победы рассчитывается на основе{hasStrength ? ' двух компонентов' : ' истории встреч'}:
                </div>
                {hasStrength && (
                  <>
                    <div className={styles.predictTooltipSection}>1. Сила команд (взвешенная сумма характеристик)</div>
                    <div className={styles.predictTooltipFormula}>
                      S = ПА×0.3 + ПЗ×0.25 + БД×0.2 + БУ×0.25
                    </div>
                    <div className={styles.predictTooltipValues}>
                      S({teamALabel}) = {strengthA.toFixed(1)}<br />
                      S({teamBLabel}) = {strengthB.toFixed(1)}<br />
                      ΔS = {strengthDiff.toFixed(1)}
                    </div>
                    <div className={styles.predictTooltipFormula}>
                      P(сила) = 1 / (1 + e<sup>−ΔS×0.01</sup>) = {(strengthProb! * 100).toFixed(1)}%
                    </div>
                  </>
                )}
                {h2hMatchCount > 0 && (
                  <>
                    <div className={styles.predictTooltipSection}>{hasStrength ? '2. ' : ''}История встреч (H2H)</div>
                    <div className={styles.predictTooltipValues}>
                      Матчей: {h2hMatchCount}, побед {teamALabel}: {h2h?.overall.wins ?? 0}<br />
                      WinRate = {h2hWinRate.toFixed(1)}% → P(h2h) = {(h2hProb * 100).toFixed(1)}%
                    </div>
                  </>
                )}
                {hasStrength && h2hMatchCount > 0 && (
                  <>
                    <div className={styles.predictTooltipSection}>3. Комбинирование</div>
                    <div className={styles.predictTooltipFormula}>
                      Вес H2H = min({h2hMatchCount}/20, 0.5) = {h2hWeight.toFixed(2)}<br />
                      Вес силы = {strengthWeight.toFixed(2)}
                    </div>
                    <div className={styles.predictTooltipFormula}>
                      P = {(strengthProb! * 100).toFixed(1)}%×{strengthWeight.toFixed(2)} + {(h2hProb * 100).toFixed(1)}%×{h2hWeight.toFixed(2)} = {(winProbA * 100).toFixed(1)}%
                    </div>
                  </>
                )}
                <div className={styles.predictTooltipResult}>
                  Итог: {teamALabel} {Math.round(winProbA * 100)}% — {teamBLabel} {Math.round(winProbB * 100)}%
                </div>
              </div>
            </span>
          </div>
          <div className={styles.predictRow}>
            <div className={styles.predictLabel}>
              <span className={styles.predictName}>{teamALabel}</span>
              <span className={styles.predictPct}>{Math.round(winProbA * 100)}%</span>
            </div>
            <div className={styles.predictBar}>
              <div className={`${styles.predictFill}${data.winnerTeamId !== data.teamAId ? ` ${styles.predictFillLoser}` : ''}`} style={{ width: `${Math.round(winProbA * 100)}%` }} />
            </div>
          </div>
          <div className={styles.predictRow}>
            <div className={styles.predictLabel}>
              <span className={styles.predictName}>{teamBLabel}</span>
              <span className={styles.predictPct}>{Math.round(winProbB * 100)}%</span>
            </div>
            <div className={styles.predictBar}>
              <div className={`${styles.predictFill}${data.winnerTeamId !== data.teamBId ? ` ${styles.predictFillLoser}` : ''}`} style={{ width: `${Math.round(winProbB * 100)}%` }} />
            </div>
          </div>
          <div className={styles.predictBasis}>На основе: {predictBasis}</div>
        </div>
      </aside>

      {/* ===== CONTENT ===== */}
      <div className={styles.content}>
        {/* Блок 1: Участники */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Участники матча</h2>
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

        {/* Блок 2: Аналитика встреч (H2H) */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Аналитика встреч</h2>
          {h2hQuery.isLoading && <Spinner />}
          {h2hQuery.error && <span className={styles.empty}>Не удалось загрузить историю встреч</span>}
          {h2h && (
            <>
              <div className={styles.h2hGrid}>
                <div className={styles.h2hCard}>
                  <span className={styles.h2hCardTitle}>Всего встреч: {h2h.overall.totalMatches}</span>
                  <div className={styles.h2hVsRow}>
                    <div className={styles.h2hTeamSide}>
                      <span className={styles.h2hTeamName}>{teamALabel}</span>
                      <span className={styles.h2hCardValue}>{Math.round(h2h.overall.winRate)}%</span>
                      <span className={styles.h2hCardMeta}>{h2h.overall.wins}W / {h2h.overall.losses}L</span>
                    </div>
                    <span className={styles.h2hVs}>vs</span>
                    <div className={styles.h2hTeamSide}>
                      <span className={styles.h2hTeamName}>{teamBLabel}</span>
                      <span className={styles.h2hCardValue}>{h2h.overall.totalMatches > 0 ? Math.round(100 - h2h.overall.winRate) : 0}%</span>
                      <span className={styles.h2hCardMeta}>{h2h.overall.losses}W / {h2h.overall.wins}L</span>
                    </div>
                  </div>
                  {h2h.overall.lastMatchAt && (
                    <span className={styles.h2hCardMeta}>Последний: {formatDateTime(h2h.overall.lastMatchAt)}</span>
                  )}
                </div>
              </div>

              {/* WR бар */}
              {h2h.overall.totalMatches > 0 && (
                <div className={styles.h2hWrBar}>
                  <span className={styles.h2hWrLabel}>{teamALabel}</span>
                  <div className={styles.h2hWrTrack}>
                    <div className={styles.h2hWrFillA} style={{ width: `${h2h.overall.winRate}%` }} />
                    <div className={styles.h2hWrFillB} style={{ width: `${100 - h2h.overall.winRate}%` }} />
                  </div>
                  <span className={styles.h2hWrLabel}>{teamBLabel}</span>
                </div>
              )}

              {/* Последние матчи */}
              {h2h.recentMatches.length > 0 && (
                <div>
                  <div className={styles.sideSectionLabel}>Последние встречи</div>
                  <div className={styles.recentMatches}>
                    {h2h.recentMatches.slice(0, 10).map((m) => (
                      <MatchTooltip key={m.matchId} matchId={m.matchId}>
                        <Link
                          to={`/matches/${m.matchId}`}
                          className={`${styles.recentBadge} ${m.isWin ? styles.recentWin : styles.recentLoss}`}
                        >
                          {m.isWin ? 'W' : 'L'}
                        </Link>
                      </MatchTooltip>
                    ))}
                  </div>
                </div>
              )}

              {/* Разбивка по типам */}
              {h2h.byMatchPattern.length > 1 && (
                <table className={styles.strengthTable}>
                  <thead>
                    <tr>
                      <th>Тип боя</th>
                      <th>Матчей</th>
                      <th>Побед</th>
                      <th>WR</th>
                      <th>Ср. Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.byMatchPattern.map((bp) => (
                      <tr key={bp.matchPattern}>
                        <td>{getMatchPatternName(bp.matchPattern)}</td>
                        <td>{bp.totalMatches}</td>
                        <td>{bp.wins}</td>
                        <td>{Math.round(bp.winRate)}%</td>
                        <td>{bp.avgScoreChange > 0 ? `+${bp.avgScoreChange}` : bp.avgScoreChange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* Блок 3: Сравнение силы команд (только Хаос) */}
        {isChaos && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Сравнение силы команд</h2>
            {propsQuery.isLoading && <Spinner />}
            {propsQuery.error && <span className={styles.empty}>Не удалось загрузить характеристики</span>}
            {teamAStats && teamBStats && (
              <div className={styles.strengthComparison}>
                <div className={styles.strengthHeader}>
                  <span className={styles.strengthTeamLabel}>{teamALabel}</span>
                  <span />
                  <span className={styles.strengthTeamLabel}>{teamBLabel}</span>
                </div>
                {STATS_LABELS.map(({ key, label }) => {
                  const valA = teamAStats[key]
                  const valB = teamBStats[key]
                  const maxVal = Math.max(valA, valB, 1)
                  const pctA = (valA / maxVal) * 100
                  const pctB = (valB / maxVal) * 100
                  const aWins = valA > valB
                  const bWins = valB > valA
                  return (
                    <div key={key} className={styles.strengthRow}>
                      <div className={styles.strengthBarSide}>
                        <span className={`${styles.strengthVal} ${aWins ? styles.higherValue : bWins ? styles.lowerValue : styles.equalValue}`}>{valA}</span>
                        <div className={styles.strengthTrack}>
                          <div
                            className={`${styles.strengthFillLeft} ${aWins ? styles.strengthFillWin : bWins ? styles.strengthFillLose : ''}`}
                            style={{ width: `${pctA}%` }}
                          />
                        </div>
                      </div>
                      <span className={styles.strengthStatLabel}>{label}</span>
                      <div className={styles.strengthBarSide}>
                        <div className={styles.strengthTrack}>
                          <div
                            className={`${styles.strengthFillRight} ${bWins ? styles.strengthFillWin : aWins ? styles.strengthFillLose : ''}`}
                            style={{ width: `${pctB}%` }}
                          />
                        </div>
                        <span className={`${styles.strengthVal} ${bWins ? styles.higherValue : aWins ? styles.lowerValue : styles.equalValue}`}>{valB}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
