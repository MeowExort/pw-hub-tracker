import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { BuffDto } from '@/shared/types/api'
import styles from './BuffIndicator.module.scss'

/** Fallback SVG-иконка для баффа без icon */
function DefaultBuffIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="16" height="16" rx="3" fill="#3a3a5c" />
      <path
        d="M8 3l1.5 3 3.5.5-2.5 2.5.5 3.5L8 11l-3 1.5.5-3.5L3 6.5 6.5 6z"
        fill="#a78bfa"
        stroke="#7c3aed"
        strokeWidth="0.5"
      />
    </svg>
  )
}

interface BuffIndicatorProps {
  buffs: BuffDto[] | undefined | null
  children: ReactNode
}

/**
 * Оборачивает значение характеристики.
 * При наведении показывает тултип со списком баффов.
 */
export function BuffIndicator({ buffs, children }: BuffIndicatorProps) {
  const list = buffs ?? []
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [placed, setPlaced] = useState(false)

  const handleEnter = () => {
    setPlaced(false)
    setHover(true)
  }

  useEffect(() => {
    if (!hover || !ref.current || !tooltipRef.current) return
    const rect = ref.current.getBoundingClientRect()
    const tt = tooltipRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const fitsBelow = rect.bottom + 4 + tt.height <= window.innerHeight
    const top = fitsBelow ? rect.bottom + 4 : rect.top - 4 - tt.height
    setPos({ top, left: cx })
    setPlaced(true)
  }, [hover])

  return (
    <span
      className={styles.wrapper}
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => { setHover(false); setPlaced(false) }}
    >
      {children}
      {hover && createPortal(
        <div
          ref={tooltipRef}
          className={styles.buffTooltip}
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)', visibility: placed ? 'visible' : 'hidden' }}
        >
          {list.length === 0 ? (
            <div className={styles.noBuffs}>без баффов</div>
          ) : (
            <div className={styles.buffList}>
              {list.map((b) => (
                <div key={b.id} className={styles.buffRow}>
                  <span className={styles.buffIcon}>
                    {b.icon ? (
                      <img src={b.icon} alt={b.name} />
                    ) : (
                      <DefaultBuffIcon />
                    )}
                  </span>
                  <div className={styles.buffInfo}>
                    <div className={styles.buffName}>{b.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
