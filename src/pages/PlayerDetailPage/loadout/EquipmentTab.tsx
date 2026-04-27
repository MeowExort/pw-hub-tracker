import { useMemo } from 'react'
import type { EquipItem, EquipmentSnapshot } from '@/shared/types/loadout'
import {
  MAIN_LAYOUT,
  POKER_SLOTS,
  STYLE_SLOTS,
  itemIconUrl,
  slotLabel,
  decodeUnicodeEscapes,
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

      <SpecialRow
        title="Стиль"
        slots={STYLE_SLOTS}
        itemsByIndex={itemsByIndex}
        highlightWithAddons
      />
    </div>
  )
}

interface PaperDollProps {
  itemsByIndex: Map<number, EquipItem>
}

function PaperDoll({ itemsByIndex }: PaperDollProps) {
  return (
    <div className={styles.dollGrid}>
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
  /**
   * Для стилевых слотов: если у предмета в этом слоте есть аддоны
   * (свойства, не камни-embed), подсвечиваем ячейку золотой рамкой.
   */
  highlightWithAddons?: boolean
}

function SpecialRow({ title, slots, itemsByIndex, highlightWithAddons }: SpecialRowProps) {
  return (
    <div className={styles.dollSection}>
      <h3 className={styles.dollSectionTitle}>{title}</h3>
      <div className={styles.specialRow}>
        {slots.map((idx) => (
          <SlotCell
            key={idx}
            label={slotLabel(idx)}
            item={itemsByIndex.get(idx)}
            highlightWithAddons={highlightWithAddons}
          />
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
  highlightWithAddons?: boolean
}

function SlotCell({ label, item, row, col, highlightWithAddons }: SlotCellProps) {
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

  // Для стилевых слотов: золотая рамка при наличии «настоящих» аддонов
  // (не embed-камней, не engraved-гравировок).
  const hasMeaningfulAddons =
    !!highlightWithAddons &&
    !!item.body?.properties?.some((p) => !p.isEmbed && !p.isEngraved)

  // Стиль с gridRow/gridColumn вешаем на сам tooltipWrapper, потому что именно он
  // является прямым потомком .dollGrid и попадает под действие grid-раскладки.
  return (
    <EquipmentItemTooltip item={item} style={style}>
      <SlotInner item={item} label={label} highlight={hasMeaningfulAddons} />
    </EquipmentItemTooltip>
  )
}

function SlotInner({
  item,
  label,
  highlight,
}: {
  item: EquipItem
  label: string
  highlight?: boolean
}) {
  const icon = itemIconUrl(item.itemId)
  const badge = badgeFor(item)
  const refine = refineFor(item)
  const itemName = decodeUnicodeEscapes(item.itemName) ?? `#${item.itemId}`
  // Браузерный title не ставим — используется только кастомный <EquipmentItemTooltip />.
  // На <img> также убираем родной title во избежание двойного тултипа.
  // Grid-раскладка применяется к внешнему tooltipWrapper, см. SlotCell.
  const className = highlight
    ? `${styles.slotCell} ${styles.slotGold}`
    : styles.slotCell
  return (
    <span
      className={className}
      role="button"
      tabIndex={0}
      aria-label={itemName}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
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

