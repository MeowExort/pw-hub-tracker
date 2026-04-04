import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getPlayerById } from '@/shared/api/players'
import type { BattleStat } from '@/shared/types/api'
import { getClassIcon, getClassName, formatTimestamp } from '@/shared/utils/format'
import styles from './PlayerTooltip.module.scss'

interface PlayerTooltipProps {
  playerId: number
  server: string
  cls?: number | null
  name?: string | null
  isCaptain?: boolean
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

function StatBlock({ label, icon, stat }: { label: string; icon: string; stat: BattleStat }) {
  const wr = wrPercent(stat.winCount, stat.battleCount)
  return (
    <div className={styles.statBlock}>
      <div className={styles.statHeader}>
        <span>{icon} {label}</span>
        {stat.rank > 0 && <span className={styles.statRank}>#{stat.rank}</span>}
      </div>
      <div className={styles.statScore}>{stat.score}</div>
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

export function PlayerTooltip({ playerId, server, cls, name, isCaptain, children }: PlayerTooltipProps) {
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

  const { data: player, isLoading } = useQuery({
    queryKey: ['player-tooltip', server, playerId],
    queryFn: () => getPlayerById(server, playerId, 'properties'),
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

  // Adjust tooltip position to stay in viewport
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
  }, [visible, player, pos])

  const orderStat = player?.battleStats?.find((s) => s.matchPattern === 0)
  const chaosStat = player?.battleStats?.find((s) => s.matchPattern === 1)

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
          to={`/players/${server}/${playerId}`}
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
          {player && (
            <>
              <div className={styles.header}>
                <img src={getClassIcon(cls ?? player.cls)} alt={getClassName(cls ?? player.cls)} className={styles.classIcon} />
                <div className={styles.headerInfo}>
                  <span className={styles.playerName}>
                    {name ?? player.name ?? `#${playerId}`}
                    {isCaptain && <span className={styles.captainBadge}> 👑</span>}
                  </span>
                  <span className={styles.className}>{getClassName(cls ?? player.cls)}</span>
                  {player.teamName && (
                    <span className={styles.teamName}>Команда: {player.teamName}</span>
                  )}
                </div>
              </div>

              {player.lastBattleTimestamp > 0 && (
                <div className={styles.lastBattle}>
                  Последний бой: {formatTimestamp(player.lastBattleTimestamp)}
                </div>
              )}

              <div className={styles.ratings}>
                {orderStat && <StatBlock label="Порядок" icon="⚔" stat={orderStat} />}
                {chaosStat && <StatBlock label="Хаос" icon="💀" stat={chaosStat} />}
                {!orderStat && !chaosStat && (
                  <div className={styles.noStats}>Нет боевой статистики</div>
                )}
              </div>

              {player.properties && (
                <div className={styles.props}>
                  <div className={styles.propsRow}>
                    <span>❤️ {player.properties.hp.toLocaleString()}</span>
                    <span>💧 {player.properties.mp.toLocaleString()}</span>
                  </div>
                  <div className={styles.propsRow}>
                    <span>⚔ {player.properties.damageLow}–{player.properties.damageHigh}</span>
                    <span>🔮 {player.properties.damageMagicLow}–{player.properties.damageMagicHigh}</span>
                  </div>
                  <div className={styles.propsRow}>
                    <span>🛡 Физ: {player.properties.defense.toLocaleString()}</span>
                    <span>🛡 Маг: {(player.properties.resistance?.[0] ?? 0).toLocaleString()}</span>
                  </div>
                  <div className={styles.propsRow}>
                    <span>⚔️ ПА: {player.properties.attackDegree.toLocaleString()}</span>
                    <span>🛡️ ПЗ: {player.properties.defendDegree.toLocaleString()}</span>
                  </div>
                  <div className={styles.propsRow}>
                    <span>💥 Физ.пробив: {player.properties.antiDefenseDegree.toLocaleString()}</span>
                    <span>✨ Маг.пробив: {player.properties.antiResistanceDegree.toLocaleString()}</span>
                  </div>
                  <div className={styles.propsRow}>
                    <span>🗡️ БУ: {player.properties.peakGrade.toLocaleString()}</span>
                    <span>🏰 БД: {player.properties.vigour.toLocaleString()}</span>
                  </div>
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
