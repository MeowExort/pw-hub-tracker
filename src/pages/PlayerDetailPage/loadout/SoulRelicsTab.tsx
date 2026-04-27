import type { SoulRelicsSnapshot } from '@/shared/types/loadout'
import styles from './LoadoutSection.module.scss'

interface Props {
  relics: SoulRelicsSnapshot
}

export function SoulRelicsTab({ relics }: Props) {
  if (!relics.relics.length) {
    return <p className={styles.empty}>Все слоты реликвий пусты</p>
  }
  return (
    <div className={styles.relicsList}>
      {relics.relics.map((r) => (
        <div key={r.orderIndex} className={styles.relicCard}>
          <div className={styles.relicHeader}>
            <span className={styles.relicName}>{r.relicName ?? `Реликвия #${r.relicId}`}</span>
            <div className={styles.relicBadges}>
              {r.soulLevel > 0 && <span className={styles.relicSoulBadge}>Уровень души {r.soulLevel}</span>}
              {r.refineLevel > 0 && <span className={styles.relicRefine}>{'★'.repeat(r.refineLevel)} {r.refineLevel}</span>}
            </div>
          </div>

          {r.mainSkillId !== 0 && (
            <div className={styles.relicMain}>
              <span>{r.mainSkillName ?? `addon #${r.mainSkillId}`}</span>
              <span className={styles.propertyValue}>{r.mainSkillDisplayValue ?? r.mainSkillValue}</span>
            </div>
          )}

          {r.extras.length > 0 && (
            <div className={styles.relicExtras}>
              {r.extras.map((e) => (
                <div key={e.slotIndex} className={styles.relicExtra}>
                  <span>{e.skillName ?? `addon #${e.skillId}`}</span>
                  <span>{e.displayValue ?? e.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
