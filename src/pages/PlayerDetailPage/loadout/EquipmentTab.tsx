import { useMemo, useState } from 'react'
import type { EquipItem, EquipmentSnapshot } from '@/shared/types/loadout'
import { EQUIPMENT_SLOTS, getSlotConfig, itemIconUrl, refineStars } from './equipmentSlots'
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

  // Дефолтно показываем оружие или первый ненулевой слот.
  const initialSlot = useMemo(() => {
    if (itemsByIndex.has(0)) return 0
    const first = equipment.items[0]
    return first ? first.slotIndex : 0
  }, [itemsByIndex, equipment.items])
  const [selected, setSelected] = useState<number>(initialSlot)
  const selectedItem = itemsByIndex.get(selected)

  const groupedSlots = useMemo(() => ({
    main: EQUIPMENT_SLOTS.filter((s) => s.group === 'main'),
    special: EQUIPMENT_SLOTS.filter((s) => s.group === 'special'),
    poker: EQUIPMENT_SLOTS.filter((s) => s.group === 'poker'),
  }), [])

  return (
    <div className={styles.equipmentLayout}>
      <div>
        <SlotGrid title="Экипировка" slots={groupedSlots.main} itemsByIndex={itemsByIndex} selected={selected} onSelect={setSelected} />
        <SlotGrid title="Дополнительно" slots={groupedSlots.special} itemsByIndex={itemsByIndex} selected={selected} onSelect={setSelected} />
        <SlotGrid title="Карты генерала" slots={groupedSlots.poker} itemsByIndex={itemsByIndex} selected={selected} onSelect={setSelected} />
      </div>
      <div>
        {selectedItem
          ? <ItemDetailsPanel item={selectedItem} />
          : <div className={styles.detailsPanel}>
              <div className={styles.placeholder}>Выберите слот, чтобы увидеть детали предмета</div>
            </div>}
      </div>
    </div>
  )
}

interface SlotGridProps {
  title: string
  slots: typeof EQUIPMENT_SLOTS
  itemsByIndex: Map<number, EquipItem>
  selected: number
  onSelect: (slot: number) => void
}

function SlotGrid({ title, slots, itemsByIndex, selected, onSelect }: SlotGridProps) {
  return (
    <div className={styles.dollSection}>
      <h3 className={styles.dollSectionTitle}>{title}</h3>
      <div className={styles.dollGrid}>
        {slots.map((s) => (
          <SlotCell
            key={s.index}
            config={s}
            item={itemsByIndex.get(s.index)}
            active={selected === s.index}
            onClick={() => onSelect(s.index)}
          />
        ))}
      </div>
    </div>
  )
}

interface SlotCellProps {
  config: ReturnType<typeof getSlotConfig> & object
  item?: EquipItem
  active: boolean
  onClick: () => void
}

function SlotCell({ config, item, active, onClick }: SlotCellProps) {
  if (!item) {
    return (
      <div className={`${styles.slotCell} ${styles.empty}`} title={config.label}>
        <span className={styles.slotEmptyLabel}>{config.label}</span>
      </div>
    )
  }
  const icon = itemIconUrl(item.itemId)
  const badge = badgeFor(item)
  return (
    <div
      className={styles.slotCell}
      onClick={onClick}
      style={active ? { borderColor: 'var(--primary)' } : undefined}
      title={item.itemName ?? `#${item.itemId}`}
    >
      {icon
        ? <img src={icon} alt={item.itemName ?? ''} className={styles.slotIcon} loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
        : <span className={styles.slotEmptyLabel}>{config.label}</span>}
      {badge && <span className={styles.slotBadge}>{badge}</span>}
    </div>
  )
}

function badgeFor(item: EquipItem): string | null {
  if (item.card) {
    const stars = '★'.repeat(Math.min(item.card.rebirthTimes, 3))
    return `Lv${item.card.level}${stars}`
  }
  if (item.astrolabe) return `Lv${item.astrolabe.level}`
  if (item.atlas) return `Lv${item.atlas.currentLevel}`
  if (item.body?.levelRequirement) return `Lv${item.body.levelRequirement}`
  return null
}

// Re-export для использования в ItemDetailsPanel.
export { refineStars }
