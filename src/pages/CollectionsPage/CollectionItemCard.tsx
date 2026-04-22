import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PShopServer } from '@/shared/api/pshop'
import type { AlertDTO } from '@/shared/api/pushAlerts'
import type { CollectionItem } from '@/shared/collections'
import type { CollectionItemData } from './hooks/useCollectionItems'
import { ItemTooltip } from '@/shared/ui/ItemTooltip'
import { formatNumber } from '@/shared/utils/pshop'
import type { CollectionPriceSide, CollectionViewMode } from './CollectionsToolbar'
import styles from './CollectionsPage.module.scss'

export interface CollectionItemCardProps {
  entry: CollectionItem
  details: CollectionItemData | null | undefined
  server: PShopServer
  view: CollectionViewMode
  priceSide: CollectionPriceSide
  isLoading: boolean
  alerts?: AlertDTO[]
  onRemove: (itemId: number) => void
  onEditNote?: (itemId: number) => void
  onConfigureAlert?: (itemId: number) => void
}

/** Карточка одного предмета внутри подборки. */
export function CollectionItemCard({
  entry,
  details,
  server,
  view,
  priceSide,
  isLoading,
  alerts,
  onRemove,
  onEditNote,
  onConfigureAlert,
}: CollectionItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (menuRef.current && menuRef.current.contains(target)) return
      if (menuBtnRef.current && menuBtnRef.current.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  if (!details && isLoading) {
    return <div className={`${styles.card} ${styles.cardSkeleton}`} aria-busy="true" />
  }

  if (!details) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardName}>#{entry.itemId}</div>
        </div>
        <div className={styles.cardMeta}>Не удалось загрузить данные</div>
      </div>
    )
  }

  const info = details.info
  const side = priceSide === 'sell' ? info.sell : info.buy
  const opposite = priceSide === 'sell' ? info.buy : info.sell
  const sidePrice = priceSide === 'sell' ? side?.min : side?.max
  const oppositePrice = priceSide === 'sell' ? opposite?.max : opposite?.min

  const targets = buildTargets(entry, alerts)

  const viewCls =
    view === 'list' ? styles.cardList : view === 'compact' ? styles.cardCompact : ''

  return (
    <div className={`${styles.card} ${viewCls}`}>
      <div className={styles.cardHead}>
        <ItemTooltip
          itemId={info.itemId}
          server={server}
          name={info.name}
          icon={info.icon ?? ''}
          nameColor={info.nameColor}
        >
          <Link to={`/items/${info.itemId}`} className={styles.cardLink}>
            {info.icon && <img src={info.icon} alt="" className={styles.cardIcon} />}
            <span
              className={styles.cardName}
              style={info.nameColor ? { color: `#${info.nameColor}` } : undefined}
            >
              {info.name}
            </span>
          </Link>
        </ItemTooltip>
      </div>

      <div className={styles.cardMenuWrap}>
        <button
          type="button"
          ref={menuBtnRef}
          className={styles.cardMenuBtn}
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          aria-label="Меню предмета"
        >
          ⋮
        </button>
        {menuOpen && (
          <div className={styles.cardMenu} ref={menuRef} onClick={(e) => e.stopPropagation()}>
            {onConfigureAlert && (
              <button onClick={() => { setMenuOpen(false); onConfigureAlert(info.itemId) }}>
                🔔 Настроить алерт
              </button>
            )}
            {onEditNote && (
              <button onClick={() => { setMenuOpen(false); onEditNote(info.itemId) }}>
                📝 Заметка
              </button>
            )}
            <Link to={`/items/${info.itemId}`} className={styles.cardMenuLink}>
              🔗 Открыть страницу
            </Link>
            <button
              className={styles.cardMenuDanger}
              onClick={() => { setMenuOpen(false); onRemove(info.itemId) }}
            >
              🗑️ Удалить из подборки
            </button>
          </div>
        )}
      </div>

      {targets.length > 0 && (
        <div className={styles.cardTargets}>
          {targets.map((t, i) => {
            const reached = isTargetReached(t.side, t.price, details, t.direction)
            const sideShort = t.side === 'sell' ? 'Прод' : 'Скуп'
            return (
              <div
                key={t.key ?? i}
                className={`${styles.cardTarget} ${reached ? styles.cardTargetReached : ''}`}
                title={`${t.side === 'sell' ? 'Продажа' : 'Скупка'} ${t.direction} ${formatNumber(t.price)}`}
              >
                <span className={styles.cardTargetBell} aria-hidden>🔔</span>
                <span className={styles.cardTargetText}>
                  {sideShort} {t.direction} {formatNumber(t.price)}
                </span>
                {reached && <span className={styles.cardTargetCheck} aria-hidden>✓</span>}
              </div>
            )
          })}
        </div>
      )}

      {entry.note && <div className={styles.cardNote} title={entry.note}>📝 {entry.note}</div>}

      <div className={styles.cardPrices}>
        <div className={styles.cardPriceMain}>
          <span className={styles.cardPriceLabel}>
            {priceSide === 'sell' ? 'Продажа' : 'Скупка'}:
          </span>
          <span className={styles.cardPriceValue}>
            {sidePrice != null ? formatNumber(sidePrice) : '—'}
          </span>
        </div>
        <div className={styles.cardPriceSub}>
          {priceSide === 'sell' ? 'Скупка' : 'Продажа'}:{' '}
          {oppositePrice != null ? formatNumber(oppositePrice) : '—'}
        </div>
      </div>

    </div>
  )
}

/** Достигнут ли пользовательский таргет для выбранной стороны. */
function isTargetReached(
  side: 'sell' | 'buy',
  target: number,
  details: CollectionItemData,
  direction: '<=' | '>=' = side === 'sell' ? '<=' : '>=',
): boolean {
  const price = side === 'sell' ? details.info.sell?.min : details.info.buy?.max
  if (price == null) return false
  return direction === '<=' ? price <= target : price >= target
}

interface TargetView {
  key?: string
  side: 'sell' | 'buy'
  price: number
  direction: '<=' | '>='
}

/** Собирает список отображаемых таргетов: серверные алерты имеют приоритет, иначе локальный fallback. */
function buildTargets(entry: CollectionItem, alerts?: AlertDTO[]): TargetView[] {
  if (alerts && alerts.length > 0) {
    return alerts.map((a) => ({
      key: a.id,
      side: a.side,
      price: a.targetPrice,
      direction: a.direction,
    }))
  }
  if (entry.targetPrice != null) {
    const side = entry.targetSide ?? 'sell'
    return [{ side, price: entry.targetPrice, direction: side === 'sell' ? '<=' : '>=' }]
  }
  return []
}
