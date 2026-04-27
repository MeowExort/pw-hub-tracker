import type { SkillRunesSnapshot } from '@/shared/types/loadout'
import styles from './LoadoutSection.module.scss'

interface Props {
  runes: SkillRunesSnapshot
}

export function SkillRunesTab({ runes }: Props) {
  if (!runes.slots.length) {
    return <p className={styles.empty}>Все слоты рун пусты</p>
  }
  return (
    <div className={styles.runesGrid}>
      {runes.slots.map((slot) => (
        <div key={slot.slot} className={styles.runeCard}>
          <span className={styles.runeSlotNum}>Слот {slot.slot + 1}</span>
          <span className={styles.runeSkill}>{slot.skillName ?? `skill #${slot.skillId}`}</span>
          {slot.runeItemName && <span className={styles.runeItem}>⚡ {slot.runeItemName}</span>}
        </div>
      ))}
    </div>
  )
}
