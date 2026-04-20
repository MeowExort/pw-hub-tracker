import { useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getPriceHistory } from '@/shared/api/pshop'
import { PriceHistoryChart } from '@/shared/ui/PriceHistoryChart'
import { daysAgoISO, formatNumber } from '@/shared/utils/pshop'
import styles from './ItemTooltip.module.scss'

interface ItemTooltipProps {
  itemId?: number
  server?: string
  name: string
  icon: string
  nameColor?: string
  count?: number
  price?: number
  children: ReactNode
}

export function ItemTooltip({ itemId, server, name, icon, nameColor, count, price, children }: ItemTooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX + rect.width / 2,
    })
  }, [])

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    updatePosition()
    timerRef.current = setTimeout(() => setVisible(true), 200)
  }

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['item-price-history-tooltip', itemId, server],
    queryFn: () => getPriceHistory(itemId!, server!, { from: daysAgoISO(30) }),
    enabled: visible && !!itemId && !!server,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (visible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect()
      if (rect.right > window.innerWidth) {
        tooltipRef.current.style.left = 'auto'
        tooltipRef.current.style.right = '8px'
        tooltipRef.current.style.transform = 'none'
      }
      if (rect.bottom > window.innerHeight) {
        if (wrapperRef.current) {
          const wrapperRect = wrapperRef.current.getBoundingClientRect()
          tooltipRef.current.style.top = `${wrapperRect.top + window.scrollY - tooltipRef.current.offsetHeight - 8}px`
        }
      }
    }
  }, [visible])

  return (
    <div
      className={styles.wrapper}
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible && position && createPortal(
        <div
          className={styles.tooltip}
          ref={tooltipRef}
          style={{ top: position.top, left: position.left }}
        >
          <div className={styles.header}>
            <img src={icon} alt={name} className={styles.icon} />
            <div className={styles.info}>
              <span className={styles.name} style={{ color: nameColor ? `#${nameColor}` : 'inherit' }}>
                {name}
              </span>
              {(count !== undefined || price !== undefined) && (
                <span className={styles.meta}>
                  {count !== undefined && `${count} шт.`}
                  {count !== undefined && price !== undefined && ' — '}
                  {price !== undefined && `${formatNumber(price)}`}
                  {count !== undefined && price !== undefined && ' - '}
                  {count !== undefined && price !== undefined && `${formatNumber(count * price)}`}
                </span>
              )}
            </div>
          </div>
          {itemId && server && (
            <div className={styles.chartWrapper}>
              {isHistoryLoading ? (
                <div className={styles.loader}>Загрузка графика...</div>
              ) : historyData ? (
                <PriceHistoryChart data={historyData} height={80} mini />
              ) : (
                <div className={styles.noData}>Нет данных о ценах</div>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
