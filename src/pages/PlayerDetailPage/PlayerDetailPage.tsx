import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlayerById, getPlayerMatches } from '@/shared/api/players'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { MatchTooltip } from '@/shared/ui/MatchTooltip'
import { TeamTooltip } from '@/shared/ui/TeamTooltip'
import {
  formatDateTime,
  formatTimestamp,
  getClassName,
  getClassIcon,
  getMatchPatternName,
  formatScoreDelta,
  formatPlayerName,
} from '@/shared/utils/format'
import { ScoreChart } from '../TeamDetailPage/ScoreChart'
import { BuffIndicator } from '@/shared/ui/BuffIndicator'
import { LoadoutSection } from './loadout/LoadoutSection'
import styles from './PlayerDetailPage.module.scss'
import alkorBg from '../../../assets/custom_bg/alkor_737617.png'

const PAGE_SIZE = 20

/** Страница деталей игрока — Sidebar + Content */
export function PlayerDetailPage() {
  const { server, playerId } = useParams<{ server: string; playerId: string }>()
  const id = Number(playerId)
  const [matchPage, setMatchPage] = useState(1)
  const [matchPattern, setMatchPattern] = useState<number | undefined>()

  const playerQuery = useQuery({
    queryKey: ['player', server, id],
    queryFn: () => getPlayerById(server!, id, 'properties,scorehistory,team'),
    enabled: !!server && !!id,
  })

  const matchesQuery = useQuery({
    queryKey: ['playerMatches', server, id, { page: matchPage, matchPattern }],
    queryFn: () => getPlayerMatches(server!, id, { page: matchPage, pageSize: PAGE_SIZE, matchPattern }),
    enabled: !!server && !!id,
  })

  if (playerQuery.isLoading) {
    return <div className={styles.center}><Spinner /></div>
  }

  if (playerQuery.error) {
    return <ErrorMessage message="Не удалось загрузить игрока" onRetry={() => playerQuery.refetch()} />
  }

  const player = playerQuery.data
  if (!player) return null

  const props = player.properties
  const scoreHistory = player.scoreHistory
  const playerTeamName = player.team?.name ?? player.teamName

  return (
    <div
      className={`${styles.layout} ${player.id === 737617 ? styles.customBg : ''}`}
      style={player.id === 737617 ? { '--custom-bg': `url(${alkorBg})` } as React.CSSProperties : undefined}
    >
      {/* ===== SIDEBAR ===== */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidePlayerIcon}>
            <img src={getClassIcon(player.cls)} alt={getClassName(player.cls)} width={40} height={40} />
          </div>
          <h1 className={styles.playerName}>{formatPlayerName(player.id, player.name)}</h1>
          <span className={styles.badge}>{getClassName(player.cls)}</span>
        </div>

        {/* Инфо */}
        <div className={styles.sideInfo}>
          <div className={styles.sideInfoRow}>
            <span className={styles.sideInfoLabel}>Команда</span>
            <Link to={`/teams/${player.teamId}`}>{playerTeamName ?? player.teamId}</Link>
          </div>
          <div className={styles.sideInfoRow}>
            <span className={styles.sideInfoLabel}>Последний бой</span>
            <span>{formatTimestamp(player.lastBattleTimestamp)}</span>
          </div>
          <div className={styles.sideInfoRow}>
            <span className={styles.sideInfoLabel}>Обновлено</span>
            <span>{formatDateTime(player.updatedAt)}</span>
          </div>
        </div>

        {/* Характеристики */}
        {props && (
          <div className={styles.sideProps}>
            <div className={styles.sideSectionLabel}>Характеристики</div>
            <div className={styles.sidePropsVitals}>
              <span className={styles.propsHp}>❤️ <BuffIndicator buffs={props.hpBuffs}>{props.hp.toLocaleString()}</BuffIndicator></span>
              <span className={styles.propsMp}>💧 <BuffIndicator buffs={props.mpBuffs}>{props.mp.toLocaleString()}</BuffIndicator></span>
            </div>
            <div className={styles.sidePropsList}>

              <div className={styles.propRow}><span className={styles.propLabel}>ПА</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.attackDegreeBuffs}>{props.attackDegree}</BuffIndicator></span></div>
              <div className={styles.propRow}><span className={styles.propLabel}>ПЗ</span><span className={`${styles.propValue} ${styles.defColor}`}><BuffIndicator buffs={props.defendDegreeBuffs}>{props.defendDegree}</BuffIndicator></span></div>
              <hr className={styles.propsDivider} />
              <div className={styles.propRow}><span className={styles.propLabel}>Физ. атака</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.damageLowBuffs}>{props.damageLow}–{props.damageHigh}</BuffIndicator></span></div>
              <div className={styles.propRow}><span className={styles.propLabel}>Маг. атака</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.damageMagicLowBuffs}>{props.damageMagicLow}–{props.damageMagicHigh}</BuffIndicator></span></div>
              <hr className={styles.propsDivider} />
              <div className={styles.propRow}><span className={styles.propLabel}>БУ</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.peakGradeBuffs}>{props.peakGrade}</BuffIndicator></span></div>
              <div className={styles.propRow}><span className={styles.propLabel}>БД</span><span className={styles.propValue}><BuffIndicator buffs={props.vigourBuffs}>{props.vigour}</BuffIndicator></span></div>
              <hr className={styles.propsDivider} />
              <div className={styles.propRow}><span className={styles.propLabel}>Физ. защита</span><span className={`${styles.propValue} ${styles.defColor}`}><BuffIndicator buffs={props.defenseBuffs}>{props.defense.toLocaleString()}</BuffIndicator></span></div>
              <div className={styles.propRow}><span className={styles.propLabel}>Маг. защита</span><span className={`${styles.propValue} ${styles.defColor}`}><BuffIndicator buffs={props.resistanceBuffs}>{props.resistance[0].toLocaleString()}</BuffIndicator></span></div>
              <hr className={styles.propsDivider} />
              <div className={styles.propRow}><span className={styles.propLabel}>Физ. пробив</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.antiDefenseDegreeBuffs}>{props.antiDefenseDegree}</BuffIndicator></span></div>
              <div className={styles.propRow}><span className={styles.propLabel}>Маг. пробив</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.antiResistanceDegreeBuffs}>{props.antiResistanceDegree}</BuffIndicator></span></div>
              <hr className={styles.propsDivider} />
              <div className={styles.propRow}><span className={styles.propLabel}>Крит. урон</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.critDamageBonusBuffs}>{props.critDamageBonus.toLocaleString()}</BuffIndicator></span></div>
              <div className={styles.propRow}><span className={styles.propLabel}>Крит. шанс</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.critRateBuffs}>{props.critRate.toLocaleString()}</BuffIndicator></span></div>
              <hr className={styles.propsDivider} />
              <div className={styles.propRow}><span className={styles.propLabel}>Меткость</span><span className={`${styles.propValue} ${styles.atkColor}`}><BuffIndicator buffs={props.attackBuffs}>{props.attack}</BuffIndicator></span></div>
              <div className={styles.propRow}><span className={styles.propLabel}>Уклонение</span><span className={`${styles.propValue} ${styles.defColor}`}><BuffIndicator buffs={props.armorBuffs}>{props.armor}</BuffIndicator></span></div>
            </div>
          </div>
        )}
      </aside>

      {/* ===== CONTENT ===== */}
      <main className={styles.content}>
        {/* Рейтинги */}
        {player.battleStats.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Текущий рейтинг</h2>
            <div className={styles.ratingsRow}>
              {player.battleStats.map((stat) => {
                const wr = stat.battleCount > 0
                  ? Math.round((stat.winCount / stat.battleCount) * 100)
                  : 0
                const wrColor = wr >= 60 ? 'var(--success)' : wr >= 50 ? 'var(--warning)' : 'var(--danger)'
                return (
                  <div key={stat.matchPattern} className={styles.ratingCard}>
                    <div className={styles.ratingCardTitle}>
                      {stat.matchPattern === 0 ? '⚔ Порядок' : '💀 Хаос'}
                    </div>
                    <div className={styles.ratingCardScore}>
                      {stat.score}
                      <span className={styles.ratingCardRank}>#{stat.rank}</span>
                    </div>
                    <div className={styles.wrBar}>
                      <div className={styles.wrTrack}>
                        <div className={styles.wrFill} style={{ width: `${wr}%`, background: wrColor }} />
                      </div>
                      <span className={styles.wrLabel}>{wr}%</span>
                    </div>
                    <div className={styles.ratingCardMeta}>
                      {stat.battleCount} боёв · {stat.winCount}W
                    </div>
                    <div className={styles.ratingCardMeta}>
                      Нед: {stat.weekBattleCount}б / {stat.weekWinCount}W
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Снаряжение (экипировка / руны / реликвии) */}
        {server && id > 0 && (
          <LoadoutSection server={server} playerId={id} />
        )}

        {/* График рейтинга */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>📈 График рейтинга</h2>
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
          {scoreHistory && scoreHistory.length > 0 && (
            <ScoreChart data={scoreHistory} />
          )}
          {scoreHistory && scoreHistory.length === 0 && (
            <p className={styles.empty}>Нет данных истории рейтинга</p>
          )}
        </div>

        {/* Матчи */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>⚔ Матчи</h2>
          {matchesQuery.isLoading && <div className={styles.center}><Spinner size="sm" /></div>}
          {matchesQuery.data && (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Матч</th>
                    <th>Тип боя</th>
                    <th>Моя команда</th>
                    <th>Противник</th>
                    <th>Результат</th>
                    <th>Δ Рейтинг</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesQuery.data.items.map((m) => {
                    const myTeamId = m.teamId
                    const isTeamA = m.match.teamAId === myTeamId
                    const opponentId = isTeamA ? m.match.teamBId : m.match.teamAId
                    const opponentName = isTeamA
                      ? (m.match.teamBName ?? m.match.teamBId)
                      : (m.match.teamAName ?? m.match.teamAId)
                    const myTeamName = isTeamA
                      ? (m.match.teamAName ?? m.match.teamAId)
                      : (m.match.teamBName ?? m.match.teamBId)
                    return (
                      <tr key={m.matchId} className={m.isWinner ? styles.win : styles.loss}>
                        <td>
                          <MatchTooltip matchId={m.matchId}>
                            <Link to={`/matches/${m.matchId}`}>#{m.matchId}</Link>
                          </MatchTooltip>
                        </td>
                        <td>{getMatchPatternName(m.match.matchPattern)}</td>
                        <td>
                          <TeamTooltip teamId={myTeamId} teamName={String(myTeamName)}>
                            <Link to={`/teams/${myTeamId}`}>{myTeamName}</Link>
                          </TeamTooltip>
                        </td>
                        <td>
                          <TeamTooltip teamId={opponentId} teamName={String(opponentName)} currentTeamId={player.teamId} currentPlayerId={player.id}>
                            <Link to={`/teams/${opponentId}`}>{opponentName}</Link>
                          </TeamTooltip>
                        </td>
                        <td className={m.isWinner ? styles.winText : styles.lossText}>
                          {m.isWinner ? 'Победа' : 'Поражение'}
                        </td>
                        <td>{formatScoreDelta(m.scoreBefore, m.scoreAfter)}</td>
                        <td className={styles.date}>{formatDateTime(m.match.createdAt)}</td>
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
      </main>
    </div>
  )
}
