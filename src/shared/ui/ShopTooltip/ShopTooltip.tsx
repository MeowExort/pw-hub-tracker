import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlayerShop } from '@/shared/api/pshop'
import { formatNumber, formatDate } from '@/shared/utils/pshop'
import styles from './ShopTooltip.module.scss'

interface ShopTooltipProps {
  playerId: number
  server: string
  playerName?: string
  highlightItemId?: number
  children: React.ReactNode
}

const MAX_ITEMS_PER_SIDE = 8

export function ShopTooltip({
  playerId,
  server,
  playerName,
  highlightItemId,
  children,
}: ShopTooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLAnchorElement>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['shop-tooltip', server, playerId],
    queryFn: () => getPlayerShop(playerId, server),
    enabled: hovered && !!playerId && !!server,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

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
    setHovered(true)
    updatePosition()
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
    if (visible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect()
      if (rect.right > window.innerWidth) {
        tooltipRef.current.style.left = 'auto'
        tooltipRef.current.style.right = '0px'
        tooltipRef.current.style.transform = 'none'
      }
      if (rect.bottom > window.innerHeight) {
        if (wrapperRef.current) {
          const wrapperRect = wrapperRef.current.getBoundingClientRect()
          tooltipRef.current.style.top = `${wrapperRect.top + window.scrollY - tooltipRef.current.offsetHeight - 8}px`
        }
      }
    }
  }, [visible, data])

  const sellItems = (data?.items ?? [])
    .filter((i) => i.isSell)
    .sort((a, b) => {
      if (highlightItemId) {
        if (a.itemId === highlightItemId && b.itemId !== highlightItemId) return -1
        if (b.itemId === highlightItemId && a.itemId !== highlightItemId) return 1
      }
      return a.price - b.price
    })
  const buyItems = (data?.items ?? [])
    .filter((i) => !i.isSell)
    .sort((a, b) => {
      if (highlightItemId) {
        if (a.itemId === highlightItemId && b.itemId !== highlightItemId) return -1
        if (b.itemId === highlightItemId && a.itemId !== highlightItemId) return 1
      }
      return b.price - a.price
    })

  return (
    <span
      className={styles.wrapper}
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible && position && createPortal(
        <Link
          to={`/shops/${server}/${playerId}`}
          className={styles.tooltip}
          ref={tooltipRef}
          style={{ top: position.top, left: position.left }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <span className={styles.title}>
              {playerName ?? `#${playerId}`}
            </span>
            {data?.shop && (
              <span className={styles.meta}>
                Видели: {formatDate(data.shop.lastSeenAt)}
              </span>
            )}
          </div>

          {isLoading && <div className={styles.loading}>Загрузка…</div>}

          {data && !isLoading && sellItems.length === 0 && buyItems.length === 0 && (
            <div className={styles.empty}>Магазин пуст</div>
          )}

          {sellItems.length > 0 && (
            <div className={styles.section}>
              <div className={`${styles.sectionTitle} ${styles.sell}`}>
                Продаёт ({sellItems.length})
              </div>
              <div className={styles.itemsList}>
                {sellItems.slice(0, MAX_ITEMS_PER_SIDE).map((i, idx) => (
                  <div className={styles.itemRow} key={`s-${i.itemId}-${idx}`}>
                    {i.item?.icon ? (
                      <img src={i.item.icon} alt="" className={styles.itemIcon} />
                    ) : (
                      <span className={styles.itemIconPlaceholder} />
                    )}
                    <span
                      className={styles.itemName}
                      style={{ color: i.item?.nameColor ? `#${i.item.nameColor}` : undefined }}
                    >
                      {i.item?.name ?? `#${i.itemId}`}
                    </span>
                    <span className={styles.itemCount}>×{formatNumber(i.itemCount)}</span>
                    <span className={`${styles.itemPrice} ${styles.sell}`}>
                      {formatNumber(i.price)}
                    </span>
                  </div>
                ))}
                {sellItems.length > MAX_ITEMS_PER_SIDE && (
                  <div className={styles.more}>
                    и ещё {sellItems.length - MAX_ITEMS_PER_SIDE}…
                  </div>
                )}
              </div>
            </div>
          )}

          {buyItems.length > 0 && (
            <div className={styles.section}>
              <div className={`${styles.sectionTitle} ${styles.buy}`}>
                Скупает ({buyItems.length})
              </div>
              <div className={styles.itemsList}>
                {buyItems.slice(0, MAX_ITEMS_PER_SIDE).map((i, idx) => (
                  <div className={styles.itemRow} key={`b-${i.itemId}-${idx}`}>
                    {i.item?.icon ? (
                      <img src={i.item.icon} alt="" className={styles.itemIcon} />
                    ) : (
                      <span className={styles.itemIconPlaceholder} />
                    )}
                    <span
                      className={styles.itemName}
                      style={{ color: i.item?.nameColor ? `#${i.item.nameColor}` : undefined }}
                    >
                      {i.item?.name ?? `#${i.itemId}`}
                    </span>
                    <span className={styles.itemCount}>×{formatNumber(i.itemCount)}</span>
                    <span className={`${styles.itemPrice} ${styles.buy}`}>
                      {formatNumber(i.price)}
                    </span>
                  </div>
                ))}
                {buyItems.length > MAX_ITEMS_PER_SIDE && (
                  <div className={styles.more}>
                    и ещё {buyItems.length - MAX_ITEMS_PER_SIDE}…
                  </div>
                )}
              </div>
            </div>
          )}
        </Link>,
        document.body,
      )}
    </span>
  )
}
