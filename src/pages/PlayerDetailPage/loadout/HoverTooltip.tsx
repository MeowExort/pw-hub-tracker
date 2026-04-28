import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './LoadoutSection.module.scss'

interface Props {
  /** Что показываем в самом tooltip-е (произвольный JSX). */
  content: ReactNode
  /** Что является «триггером» (то, на что наводят курсор). */
  children: ReactNode
  /**
   * Стиль обёрточного span-а. Нужен, когда триггер сидит в grid-е
   * с явным placement-ом (grid-row/grid-column) — иначе grid auto-flow
   * проигнорирует расстановку дочерних элементов.
   */
  style?: React.CSSProperties
  className?: string
  /** Задержка перед показом, мс. По умолчанию 150. */
  delayMs?: number
}

/**
 * Универсальный hover-tooltip с порталом в document.body и
 * авто-репозиционированием, если выходит за viewport.
 *
 * Тот же скелет, что у <c>EquipmentItemTooltip</c> (контент там жёстко
 * <c>ItemDetailsPanel</c>), здесь content — произвольный ReactNode,
 * чтобы переиспользовать в скилловых рунах и где ещё пригодится.
 */
export function HoverTooltip({ content, children, style, className, delayMs = 150 }: Props) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setPosition({
      top: rect.top + window.scrollY,
      left: rect.right + window.scrollX + 12,
    })
  }, [])

  const handleEnter = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    updatePosition()
    showTimer.current = setTimeout(() => setVisible(true), delayMs)
  }

  const handleLeave = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    setVisible(false)
  }

  useEffect(() => {
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current)
    }
  }, [])

  // Если выходит за правый/нижний край — пересаживаем влево/наверх.
  useEffect(() => {
    if (!visible || !tooltipRef.current || !wrapperRef.current) return
    const tt = tooltipRef.current
    const rect = tt.getBoundingClientRect()
    const wrapperRect = wrapperRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) {
      tt.style.left = `${wrapperRect.left + window.scrollX - tt.offsetWidth - 12}px`
    }
    if (rect.bottom > window.innerHeight - 8) {
      const newTop = window.innerHeight + window.scrollY - tt.offsetHeight - 8
      tt.style.top = `${Math.max(window.scrollY + 8, newTop)}px`
    }
  }, [visible])

  return (
    <span
      ref={wrapperRef}
      className={`${styles.tooltipWrapper} ${className ?? ''}`.trim()}
      style={style}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {visible && position && createPortal(
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{ top: position.top, left: position.left }}
          role="tooltip"
        >
          {content}
        </div>,
        document.body,
      )}
    </span>
  )
}
