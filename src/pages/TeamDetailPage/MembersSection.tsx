import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { TeamMember } from '@/shared/types/api'
import {
  getClassName,
  getClassIcon,
  getMatchPatternName,
  calcWinRate,
  formatTimestamp,
} from '@/shared/utils/format'
import styles from './MembersSection.module.scss'

type ViewMode = 'cards' | 'table'

interface Props {
  members: TeamMember[]
}


/** Секция участников команды с двумя режимами отображения */
export function MembersSection({ members }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Участники</h2>
        <div className={styles.controls}>
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
        <CardsView members={members} />
      ) : (
        <TableView members={members} />
      )}
    </div>
  )
}

/** Карточки участников */
function CardsView({ members }: { members: TeamMember[] }) {
  return (
    <div className={styles.cardsGrid}>
      {members.map((m) => (
        <div key={m.playerId} className={styles.card}>
          <div className={styles.cardHeader}>
            <Link to={`/players/${m.playerId}`}>
              <img src={getClassIcon(m.player.cls)} alt={getClassName(m.player.cls)} className={styles.classIcon} title={getClassName(m.player.cls)} />
            </Link>
            <Link to={`/players/${m.playerId}`} className={styles.cardName}>
              {m.playerId}
            </Link>
          </div>
          <div className={styles.cardLastBattle}>
            Последний бой: {formatTimestamp(m.player.lastBattleTimestamp)}
          </div>
          {m.player.battleStats.length > 0 && (
            <div className={styles.cardStats}>
              {[...m.player.battleStats].sort((a, b) => b.matchPattern - a.matchPattern).map((stat) => (
                <div key={stat.matchPattern} className={styles.cardStatBlock}>
                  <div className={styles.cardStatTitle}>
                    {getMatchPatternName(stat.matchPattern)}
                  </div>
                  <div className={styles.cardStatRow}>
                    <span className={styles.cardStatLabel}>Рейтинг</span>
                    <span className={styles.cardStatValue}>{stat.score}</span>
                  </div>
                  <div className={styles.cardStatRow}>
                    <span className={styles.cardStatLabel}>Винрейт</span>
                    <span className={styles.cardStatValue}>
                      {calcWinRate(stat.winCount, stat.battleCount)}
                    </span>
                  </div>
                  <div className={styles.cardStatRow}>
                    <span className={styles.cardStatLabel}>Бои</span>
                    <span className={styles.cardStatValue}>
                      {stat.winCount} / {stat.battleCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Таблица участников */
function TableView({ members }: { members: TeamMember[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>ID</th>
          <th>Тип</th>
          <th>Рейтинг</th>
          <th>Побед/Боёв</th>
          <th>Винрейт</th>
          <th>Последний бой</th>
        </tr>
      </thead>
      {members.map((m) => {
          const sorted = [...m.player.battleStats].sort((a, b) => b.matchPattern - a.matchPattern)
          return (
            <tbody key={m.playerId} className={styles.playerGroup}>
              {sorted.length > 0 ? (
                sorted.map((stat, i) => (
                  <tr key={`${m.playerId}-${stat.matchPattern}`} className={i > 0 ? styles.subRow : ''}>
                    {i === 0 && (
                      <>
                        <td rowSpan={sorted.length} className={styles.idCell}>
                          <Link to={`/players/${m.playerId}`}>
                            <img src={getClassIcon(m.player.cls)} alt={getClassName(m.player.cls)} className={styles.classIcon} title={getClassName(m.player.cls)} />
                            {m.playerId}
                          </Link>
                        </td>
                      </>
                    )}
                    <td>{getMatchPatternName(stat.matchPattern)}</td>
                    <td>{stat.score}</td>
                    <td>{stat.winCount} / {stat.battleCount}</td>
                    <td>{calcWinRate(stat.winCount, stat.battleCount)}</td>
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
                    <Link to={`/players/${m.playerId}`}>
                      <img src={getClassIcon(m.player.cls)} alt={getClassName(m.player.cls)} className={styles.classIcon} title={getClassName(m.player.cls)} />
                      {m.playerId}
                    </Link>
                  </td>
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
