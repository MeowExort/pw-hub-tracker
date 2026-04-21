import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PShopServer } from '@/shared/api/pshop'
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
  onRemove,
  onEditNote,
  onConfigureAlert,
}: CollectionItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

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

  const reached = isTargetReached(entry, details)

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

        <button
          type="button"
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
          <div className={styles.cardMenu} onClick={(e) => e.stopPropagation()}>
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

      {entry.targetPrice != null && (
        <div className={`${styles.cardTarget} ${reached ? styles.cardTargetReached : ''}`}>
          🎯 Таргет: {formatNumber(entry.targetPrice)}
          {reached && ' ✓'}
        </div>
      )}

      {entry.note && <div className={styles.cardNote}>📝 {entry.note}</div>}
    </div>
  )
}

/** Достигнут ли пользовательский таргет для выбранной стороны. */
function isTargetReached(entry: CollectionItem, details: CollectionItemData): boolean {
  if (entry.targetPrice == null) return false
  const side = entry.targetSide ?? 'sell'
  const price = side === 'sell' ? details.info.sell?.min : details.info.buy?.max
  if (price == null) return false
  return side === 'sell' ? price <= entry.targetPrice : price >= entry.targetPrice
}
