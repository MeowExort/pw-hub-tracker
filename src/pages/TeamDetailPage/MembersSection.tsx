import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { TeamMember, BattleStat } from '@/shared/types/api'
import {
  getClassName,
  getClassIcon,
  getMatchPatternName,
  formatTimestamp,
  formatPlayerName,
} from '@/shared/utils/format'
import { PlayerTooltip } from '@/shared/ui/PlayerTooltip'
import styles from './MembersSection.module.scss'

type ViewMode = 'cards' | 'table'
type SortKey = 'name' | 'rating' | 'winrate' | 'battles'

interface Props {
  members: TeamMember[]
  captainId?: number
}

/** Получить лучший рейтинг участника (макс score среди всех matchPattern) */
function getBestScore(m: TeamMember): number {
  if (!m.player.battleStats.length) return 0
  return Math.max(...m.player.battleStats.map((s) => s.score))
}

/** Получить общий WR */
function getTotalWr(m: TeamMember): number {
  const totals = m.player.battleStats.reduce(
    (acc, s) => ({ wins: acc.wins + s.winCount, battles: acc.battles + s.battleCount }),
    { wins: 0, battles: 0 },
  )
  return totals.battles > 0 ? (totals.wins / totals.battles) * 100 : 0
}

/** Получить общее кол-во боёв */
function getTotalBattles(m: TeamMember): number {
  return m.player.battleStats.reduce((acc, s) => acc + s.battleCount, 0)
}

/** WR число */
function calcWrPercent(wins: number, total: number): number {
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

/** Цвет WR бара */
function wrColor(wr: number): string {
  if (wr >= 60) return 'var(--success, #27ae60)'
  if (wr >= 50) return 'var(--warning, #f39c12)'
  return 'var(--danger, #e74c3c)'
}

/** Прогресс-бар WR */
function WinRateBar({ wins, total }: { wins: number; total: number }) {
  const wr = calcWrPercent(wins, total)
  return (
    <div className={styles.wrBar}>
      <div className={styles.wrBarTrack}>
        <div
          className={styles.wrBarFill}
          style={{ width: `${wr}%`, background: wrColor(wr) }}
        />
      </div>
      <span className={styles.wrBarLabel}>{wr}%</span>
    </div>
  )
}

/** Секция участников команды */
export function MembersSection({ members, captainId }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [sortKey, setSortKey] = useState<SortKey>('rating')

  const sorted = useMemo(() => {
    const arr = [...members]
    switch (sortKey) {
      case 'name':
        return arr.sort((a, b) => (a.player.name ?? '').localeCompare(b.player.name ?? ''))
      case 'rating':
        return arr.sort((a, b) => getBestScore(b) - getBestScore(a))
      case 'winrate':
        return arr.sort((a, b) => getTotalWr(b) - getTotalWr(a))
      case 'battles':
        return arr.sort((a, b) => getTotalBattles(b) - getTotalBattles(a))
      default:
        return arr
    }
  }, [members, sortKey])

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>👥 Состав ({members.length})</h2>
        <div className={styles.controls}>
          <select
            className={styles.select}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="rating">По рейтингу</option>
            <option value="winrate">По винрейту</option>
            <option value="battles">По боям</option>
            <option value="name">По имени</option>
          </select>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'cards' ? styles.active : ''}`}
              onClick={() => setViewMode('cards')}
              title="Карточки"
            >
              ▦
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
              onClick={() => setViewMode('table')}
              title="Таблица"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <CardsView members={sorted} captainId={captainId} />
      ) : (
        <TableView members={sorted} captainId={captainId} />
      )}
    </div>
  )
}

/** Карточки участников */
function CardsView({ members, captainId }: { members: TeamMember[]; captainId?: number }) {
  return (
    <div className={styles.cardsGrid}>
      {members.map((m) => {
        const isCaptain = m.playerId === captainId
        return (
          <div key={m.playerId} className={`${styles.card} ${isCaptain ? styles.captainCard : ''}`}>
            <div className={styles.cardHeader}>
              <PlayerTooltip
                playerId={m.playerId}
                server={m.player.server || 'unknown'}
                cls={m.player.cls}
                name={m.player.name ?? null}
                isCaptain={isCaptain}
              >
                <Link to={`/players/${m.player.server ?? 'unknown'}/${m.playerId}`}>
                  <img src={getClassIcon(m.player.cls)} alt={getClassName(m.player.cls)} className={styles.classIcon} title={getClassName(m.player.cls)} />
                </Link>
              </PlayerTooltip>
              <div className={styles.cardNameBlock}>
                <PlayerTooltip
                  playerId={m.playerId}
                  server={m.player.server ?? 'unknown'}
                  cls={m.player.cls}
                  name={m.player.name ?? null}
                  isCaptain={isCaptain}
                >
                  <Link to={`/players/${m.player.server ?? 'unknown'}/${m.playerId}`} className={styles.cardName}>
                    {isCaptain && <span className={styles.captainBadge}>👑 </span>}
                    {formatPlayerName(m.playerId, m.player.name)}
                  </Link>
                </PlayerTooltip>
              </div>
            </div>
            <div className={styles.cardLastBattle}>
              Последний бой: {formatTimestamp(m.player.lastBattleTimestamp)}
            </div>
            {m.player.battleStats.length > 0 && (
              <div className={styles.cardStats}>
                {[...m.player.battleStats].sort((a, b) => b.matchPattern - a.matchPattern).map((stat) => (
                  <StatBlock key={stat.matchPattern} stat={stat} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Блок статистики внутри карточки */
function StatBlock({ stat }: { stat: BattleStat }) {
  return (
    <div className={styles.cardStatBlock}>
      <div className={styles.cardStatTitle}>
        {getMatchPatternName(stat.matchPattern)}
      </div>
      <div className={styles.cardStatScore}>
        <span className={styles.scoreValue}>{stat.score}</span>
        {stat.rank > 0 && <span className={styles.scoreRank}>#{stat.rank}</span>}
      </div>
      <WinRateBar wins={stat.winCount} total={stat.battleCount} />
      <div className={styles.cardStatRow}>
        <span className={styles.cardStatLabel}>Бои</span>
        <span className={styles.cardStatValue}>
          {stat.winCount}W / {stat.battleCount}
        </span>
      </div>
      {stat.weekBattleCount > 0 && (
        <div className={styles.cardStatWeek}>
          Неделя: +{stat.weekWinCount}W / {stat.weekBattleCount}б
        </div>
      )}
    </div>
  )
}

/** Таблица участников */
function TableView({ members, captainId }: { members: TeamMember[]; captainId?: number }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Игрок</th>
          <th>Тип</th>
          <th>Рейтинг</th>
          <th>WR</th>
          <th>Побед / Боёв</th>
          <th>Неделя</th>
          <th>Последний бой</th>
        </tr>
      </thead>
      {members.map((m) => {
        const sorted = [...m.player.battleStats].sort((a, b) => b.matchPattern - a.matchPattern)
        const isCaptain = m.playerId === captainId
        return (
          <tbody key={m.playerId} className={styles.playerGroup}>
            {sorted.length > 0 ? (
              sorted.map((stat, i) => (
                <tr key={`${m.playerId}-${stat.matchPattern}`} className={i > 0 ? styles.subRow : ''}>
                  {i === 0 && (
                    <td rowSpan={sorted.length} className={styles.idCell}>
                      <PlayerTooltip
                        playerId={m.playerId}
                        server={m.player.server ?? 'unknown'}
                        cls={m.player.cls}
                        name={m.player.name ?? null}
                        isCaptain={isCaptain}
                      >
                        <Link to={`/players/${m.player.server ?? 'unknown'}/${m.playerId}`}>
                          <img src={getClassIcon(m.player.cls)} alt={getClassName(m.player.cls)} className={styles.classIcon} title={getClassName(m.player.cls)} />
                          {formatPlayerName(m.playerId, m.player.name)}
                        </Link>
                      </PlayerTooltip>
                      {isCaptain && <span className={styles.captainBadgeSmall}>👑</span>}
                    </td>
                  )}
                  <td>{getMatchPatternName(stat.matchPattern)}</td>
                  <td className={styles.ratingCell}>
                    <strong>{stat.score}</strong>
                    {stat.rank > 0 && <span className={styles.rankLabel}> #{stat.rank}</span>}
                  </td>
                  <td className={styles.wrCell}>
                    <WinRateBar wins={stat.winCount} total={stat.battleCount} />
                  </td>
                  <td>{stat.winCount} / {stat.battleCount}</td>
                  <td className={styles.weekCell}>
                    {stat.weekBattleCount > 0
                      ? `+${stat.weekWinCount}W / ${stat.weekBattleCount}б`
                      : '—'}
                  </td>
                  {i === 0 && (
                    <td rowSpan={sorted.length} className={styles.date}>
                      {formatTimestamp(m.player.lastBattleTimestamp)}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td className={styles.idCell}>
                  <PlayerTooltip
                    playerId={m.playerId}
                    server={m.player.server ?? 'unknown'}
                    cls={m.player.cls}
                    name={m.player.name ?? null}
                    isCaptain={isCaptain}
                  >
                    <Link to={`/players/${m.player.server ?? 'unknown'}/${m.playerId}`}>
                      <img src={getClassIcon(m.player.cls)} alt={getClassName(m.player.cls)} className={styles.classIcon} title={getClassName(m.player.cls)} />
                      {formatPlayerName(m.playerId, m.player.name)}
                    </Link>
                  </PlayerTooltip>
                  {isCaptain && <span className={styles.captainBadgeSmall}>👑</span>}
                </td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td className={styles.date}>{formatTimestamp(m.player.lastBattleTimestamp)}</td>
              </tr>
            )}
          </tbody>
        )
      })}
    </table>
  )
}
