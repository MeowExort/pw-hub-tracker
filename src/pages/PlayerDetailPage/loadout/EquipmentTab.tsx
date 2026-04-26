import { useMemo, useState } from 'react'
import type { EquipItem, EquipmentSnapshot } from '@/shared/types/loadout'
import {
  MAIN_LAYOUT,
  POKER_SLOTS,
  STYLE_SLOTS,
  itemIconUrl,
  slotLabel,
} from './equipmentSlots'
import { ItemDetailsPanel } from './ItemDetailsPanel'
import styles from './LoadoutSection.module.scss'

interface Props {
  equipment: EquipmentSnapshot
}

export function EquipmentTab({ equipment }: Props) {
  const itemsByIndex = useMemo(() => {
    const m = new Map<number, EquipItem>()
    for (const item of equipment.items) m.set(item.slotIndex, item)
    return m
  }, [equipment])

  // По умолчанию выделяем оружие или первый ненулевой слот.
  const initialSlot = useMemo(() => {
    if (itemsByIndex.has(0)) return 0
    const first = equipment.items[0]
    return first ? first.slotIndex : -1
  }, [itemsByIndex, equipment.items])
  const [selected, setSelected] = useState<number>(initialSlot)
  const selectedItem = selected >= 0 ? itemsByIndex.get(selected) : undefined

  return (
    <div className={styles.equipmentLayout}>
      <div>
        <PaperDoll itemsByIndex={itemsByIndex} selected={selected} onSelect={setSelected} />

        <SpecialRow
          title="Карты генерала"
          slots={POKER_SLOTS}
          itemsByIndex={itemsByIndex}
          selected={selected}
          onSelect={setSelected}
        />

        <SpecialRow
          title="Стиль"
          slots={STYLE_SLOTS}
          itemsByIndex={itemsByIndex}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <div>
        {selectedItem ? (
          <ItemDetailsPanel item={selectedItem} />
        ) : (
          <div className={styles.detailsPanel}>
            <div className={styles.placeholder}>
              Выберите слот, чтобы увидеть детали предмета
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface PaperDollProps {
  itemsByIndex: Map<number, EquipItem>
  selected: number
  onSelect: (slot: number) => void
}

function PaperDoll({ itemsByIndex, selected, onSelect }: PaperDollProps) {
  return (
    <div className={styles.dollGrid}>
      <div className={styles.dollSilhouette} aria-hidden="true">
        <Silhouette />
      </div>
      {MAIN_LAYOUT.map((s) => {
        // -1 = зарезервированная пустота (для выравнивания сетки).
        if (s.index < 0) {
          return (
            <div
              key={`reserved-${s.row}-${s.col}`}
              className={`${styles.slotCell} ${styles.slotReserved}`}
              style={{ gridRow: s.row, gridColumn: s.col }}
              aria-hidden="true"
            />
          )
        }
        return (
          <SlotCell
            key={s.index}
            row={s.row}
            col={s.col}
            label={slotLabel(s.index)}
            item={itemsByIndex.get(s.index)}
            active={selected === s.index}
            onClick={() => itemsByIndex.has(s.index) && onSelect(s.index)}
          />
        )
      })}
    </div>
  )
}

interface SpecialRowProps {
  title: string
  slots: number[]
  itemsByIndex: Map<number, EquipItem>
  selected: number
  onSelect: (slot: number) => void
}

function SpecialRow({ title, slots, itemsByIndex, selected, onSelect }: SpecialRowProps) {
  return (
    <div className={styles.dollSection}>
      <h3 className={styles.dollSectionTitle}>{title}</h3>
      <div className={styles.specialRow}>
        {slots.map((idx) => (
          <SlotCell
            key={idx}
            label={slotLabel(idx)}
            item={itemsByIndex.get(idx)}
            active={selected === idx}
            onClick={() => itemsByIndex.has(idx) && onSelect(idx)}
          />
        ))}
      </div>
    </div>
  )
}

interface SlotCellProps {
  label: string
  item?: EquipItem
  active: boolean
  onClick: () => void
  row?: number
  col?: number
}

function SlotCell({ label, item, active, onClick, row, col }: SlotCellProps) {
  const style: React.CSSProperties = {}
  if (row && col) {
    style.gridRow = row
    style.gridColumn = col
  }

  if (!item) {
    return (
      <div
        className={`${styles.slotCell} ${styles.slotEmpty}`}
        style={style}
        title={label}
      >
        <span className={styles.slotEmptyLabel}>{label}</span>
      </div>
    )
  }

  const icon = itemIconUrl(item.itemId)
  const badge = badgeFor(item)
  const refine = refineFor(item)

  return (
    <button
      type="button"
      className={`${styles.slotCell} ${active ? styles.slotActive : ''}`}
      style={style}
      onClick={onClick}
      title={item.itemName ?? `#${item.itemId}`}
    >
      {icon ? (
        <img
          src={icon}
          alt={item.itemName ?? ''}
          className={styles.slotIcon}
          loading="lazy"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        <span className={styles.slotEmptyLabel}>{label}</span>
      )}
      {refine && <span className={styles.slotRefine}>+{refine}</span>}
      {badge && <span className={styles.slotBadge}>{badge}</span>}
    </button>
  )
}

function badgeFor(item: EquipItem): string | null {
  if (item.card) {
    const stars = '★'.repeat(Math.min(item.card.rebirthTimes, 3))
    return `Lv${item.card.level}${stars}`
  }
  if (item.astrolabe) return `Lv${item.astrolabe.level}`
  if (item.atlas) return `Lv${item.atlas.currentLevel}`
  return null
}

function refineFor(item: EquipItem): number | null {
  if (!item.body?.properties?.length) return null
  for (const p of item.body.properties) {
    if (
      p.params.length >= 2 &&
      p.params[1] >= 1 &&
      p.params[1] <= 12 &&
      !p.isEmbed &&
      !p.isEngraved
    ) {
      return p.params[1]
    }
  }
  return null
}

function Silhouette() {
  return (
    <svg viewBox="0 0 100 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="16" ry="20" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M30 60 Q50 55 70 60 L75 130 Q70 140 50 140 Q30 140 25 130 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M30 65 L20 110 L25 115 L35 75" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M70 65 L80 110 L75 115 L65 75" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M40 140 L35 200 L42 205 L48 150" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M60 140 L65 200 L58 205 L52 150" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
