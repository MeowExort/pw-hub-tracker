import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EquipItem } from '@/shared/types/loadout'
import { ItemDetailsPanel } from './ItemDetailsPanel'
import styles from './LoadoutSection.module.scss'

interface Props {
  item: EquipItem
  children: ReactNode
  /**
   * CSS-стиль для самого wrapper-spans. Нужен, чтобы grid-row/grid-column
   * попадали на прямого ребёнка grid-контейнера (sам span tooltipWrapper),
   * иначе grid auto-flow проигнорирует raskладку MAIN_LAYOUT.
   */
  style?: React.CSSProperties
}

/**
 * Плавающий tooltip с деталями экипировки.
 * Логика позиционирования по образцу <c>shared/ui/ItemTooltip</c>:
 * портал в document.body, авто-репозиционирование если выходит за окно.
 */
export function EquipmentItemTooltip({ item, children, style }: Props) {
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
    showTimer.current = setTimeout(() => setVisible(true), 150)
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

  // Репозиционирование если tooltip выходит за пределы viewport.
  useEffect(() => {
    if (!visible || !tooltipRef.current || !wrapperRef.current) return
    const tt = tooltipRef.current
    const rect = tt.getBoundingClientRect()
    const wrapperRect = wrapperRef.current.getBoundingClientRect()

    // Если выходит за правый край — показываем слева от ячейки.
    if (rect.right > window.innerWidth - 8) {
      tt.style.left = `${wrapperRect.left + window.scrollX - tt.offsetWidth - 12}px`
    }
    // Если выходит снизу — поднимаем так, чтобы влезал.
    if (rect.bottom > window.innerHeight - 8) {
      const newTop = window.innerHeight + window.scrollY - tt.offsetHeight - 8
      tt.style.top = `${Math.max(window.scrollY + 8, newTop)}px`
    }
  }, [visible])

  return (
    <span
      ref={wrapperRef}
      className={styles.tooltipWrapper}
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
          <ItemDetailsPanel item={item} embedded />
        </div>,
        document.body,
      )}
    </span>
  )
}
