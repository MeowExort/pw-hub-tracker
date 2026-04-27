import type { SoulRelicEntry, SoulRelicsSnapshot } from '@/shared/types/loadout'
import styles from './LoadoutSection.module.scss'

interface Props {
  relics: SoulRelicsSnapshot
}

/**
 * Реликвии всегда приходят 12 штук: первые 6 — «Душа Покоя», следующие 6 — «Душа Тяньюй».
 * Рисуем две колонки маленьких карточек: <имя> +<заточка>, основной стат, разделитель,
 * доп. статы. Пустые слоты не рендерим (relicId === 0 / mainSkillId === 0 — пустой слот).
 */
export function SoulRelicsTab({ relics }: Props) {
  if (!relics.relics.length) {
    return <p className={styles.empty}>Все слоты реликвий пусты</p>
  }

  const sorted = [...relics.relics].sort((a, b) => a.orderIndex - b.orderIndex)
  const peace = sorted.filter((r) => r.orderIndex < 5)
  const tianyu = sorted.filter((r) => r.orderIndex >= 5)

  return (
    <div className={styles.relicsBoard}>
      <RelicColumn title="Душа Покоя" items={peace} />
      <RelicColumn title="Душа Тяньюй" items={tianyu} />
    </div>
  )
}

function RelicColumn({ title, items }: { title: string; items: SoulRelicEntry[] }) {
  return (
    <div className={styles.relicColumn}>
      <h4 className={styles.relicColumnTitle}>{title}</h4>
      {items.length === 0 ? (
        <p className={styles.relicColumnEmpty}>Все слоты пусты</p>
      ) : (
        <div className={styles.relicGrid}>
          {items.map((r) => (
            <RelicCard key={r.orderIndex} relic={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RelicCard({ relic: r }: { relic: SoulRelicEntry }) {
  const name = r.relicName ?? `Реликвия #${r.relicId}`
  const hasMain = r.mainSkillId !== 0
  const hasExtras = r.extras.length > 0

  return (
    <div className={styles.relicMiniCard}>
      <div className={styles.relicMiniHeader}>
        <span className={styles.relicMiniName} title={name}>{name}</span>
        {r.refineLevel > 0 && (
          <span className={styles.relicMiniRefine}>+{r.refineLevel}</span>
        )}
      </div>

      {hasMain && (
        <div className={styles.relicMiniMain}>
          <span className={styles.relicMiniStatName}>
            {r.mainSkillName ?? `addon #${r.mainSkillId}`}
          </span>
          <span className={styles.relicMiniStatValue}>
            {r.mainSkillDisplayValue ?? r.mainSkillValue}
          </span>
        </div>
      )}

      {hasMain && hasExtras && <hr className={styles.relicMiniDivider} />}

      {hasExtras && (
        <ul className={styles.relicMiniExtras}>
          {r.extras.map((e) => (
            <li key={e.slotIndex} className={styles.relicMiniExtra}>
              <span className={styles.relicMiniStatName}>
                {e.skillName ?? `addon #${e.skillId}`}
              </span>
              <span className={styles.relicMiniStatValue}>
                {e.displayValue ?? e.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
