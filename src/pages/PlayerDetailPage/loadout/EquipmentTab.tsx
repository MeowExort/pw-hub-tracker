import { useMemo } from 'react'
import type { EquipItem, EquipmentSnapshot } from '@/shared/types/loadout'
import {
  MAIN_LAYOUT,
  POKER_SLOTS,
  STYLE_SLOTS,
  itemIconUrl,
  slotLabel,
} from './equipmentSlots'
import { EquipmentItemTooltip } from './EquipmentItemTooltip'
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

  return (
    <div className={styles.equipmentLayout}>
      <PaperDoll itemsByIndex={itemsByIndex} />

      <SpecialRow
        title="Карты генерала"
        slots={POKER_SLOTS}
        itemsByIndex={itemsByIndex}
      />

      <SpecialRow title="Стиль" slots={STYLE_SLOTS} itemsByIndex={itemsByIndex} />
    </div>
  )
}

interface PaperDollProps {
  itemsByIndex: Map<number, EquipItem>
}

function PaperDoll({ itemsByIndex }: PaperDollProps) {
  return (
    <div className={styles.dollGrid}>
      <div className={styles.dollSilhouette} aria-hidden="true">
        <Silhouette />
      </div>
      {MAIN_LAYOUT.map((s) => {
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
}

function SpecialRow({ title, slots, itemsByIndex }: SpecialRowProps) {
  return (
    <div className={styles.dollSection}>
      <h3 className={styles.dollSectionTitle}>{title}</h3>
      <div className={styles.specialRow}>
        {slots.map((idx) => (
          <SlotCell key={idx} label={slotLabel(idx)} item={itemsByIndex.get(idx)} />
        ))}
      </div>
    </div>
  )
}

interface SlotCellProps {
  label: string
  item?: EquipItem
  row?: number
  col?: number
}

function SlotCell({ label, item, row, col }: SlotCellProps) {
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

  return (
    <EquipmentItemTooltip item={item}>
      <SlotInner item={item} style={style} label={label} />
    </EquipmentItemTooltip>
  )
}

function SlotInner({
  item,
  style,
  label,
}: {
  item: EquipItem
  style: React.CSSProperties
  label: string
}) {
  const icon = itemIconUrl(item.itemId)
  const badge = badgeFor(item)
  const refine = refineFor(item)
  return (
    <span
      className={styles.slotCell}
      style={style}
      title={item.itemName ?? `#${item.itemId}`}
      role="button"
      tabIndex={0}
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
    </span>
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
