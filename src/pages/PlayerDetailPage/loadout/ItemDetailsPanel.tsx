import type { EquipItem, ItemEssence } from '@/shared/types/loadout'
import { crystalColorHex, crystalColorName, itemIconUrl } from './equipmentSlots'
import styles from './LoadoutSection.module.scss'

interface Props {
  item: EquipItem
}

export function ItemDetailsPanel({ item }: Props) {
  const icon = itemIconUrl(item.itemId)
  const subtitle = subtitleOf(item)

  return (
    <div className={styles.detailsPanel}>
      <div className={styles.detailsHeader}>
        {icon && <img src={icon} alt={item.itemName ?? ''} className={styles.detailsIcon} onError={(e) => (e.currentTarget.style.display = 'none')} />}
        <div className={styles.detailsTitle}>
          <span className={styles.detailsName}>{item.itemName ?? `#${item.itemId}`}</span>
          {subtitle && <span className={styles.detailsMeta}>{subtitle}</span>}
        </div>
      </div>

      {item.body && <BodyBlock body={item.body} />}
      {item.essence && <EssenceBlock essence={item.essence} />}
      {item.astrolabe && <AstrolabeBlock astrolabe={item.astrolabe} />}
      {item.atlas && <AtlasBlock atlas={item.atlas} />}
      {item.card && <CardBlock card={item.card} />}
    </div>
  )
}

function subtitleOf(item: EquipItem): string | null {
  const parts: string[] = []
  if (item.body?.levelRequirement) parts.push(`Lv ${item.body.levelRequirement}`)
  if (item.body?.maxEndurance) {
    parts.push(`Прочн. ${item.body.currentEndurance.toLocaleString()}/${item.body.maxEndurance.toLocaleString()}`)
  }
  if (item.body?.makerName) parts.push(`✦ ${item.body.makerName}`)
  return parts.join(' · ') || null
}

function BodyBlock({ body }: { body: NonNullable<EquipItem['body']> }) {
  const reqs: Array<[string, number]> = []
  if (body.strengthRequirement) reqs.push(['Сила', body.strengthRequirement])
  if (body.agilityRequirement) reqs.push(['Ловкость', body.agilityRequirement])
  if (body.energyRequirement) reqs.push(['Интеллект', body.energyRequirement])
  if (body.vitalityRequirement) reqs.push(['Выносл.', body.vitalityRequirement])

  return (
    <>
      {reqs.length > 0 && (
        <div className={styles.detailsBlock}>
          <h4>Требования</h4>
          {reqs.map(([k, v]) => (
            <div key={k} className={styles.statRow}>
              <span className={styles.statLabel}>{k}</span>
              <span className={styles.statValue}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {body.holes.length > 0 && (
        <div className={styles.detailsBlock}>
          <h4>Гнёзда ({body.holes.length})</h4>
          {body.holes.map((h, i) => (
            <div key={i} className={styles.statRow}>
              <span className={styles.statLabel}>#{h.orderIndex + 1}</span>
              <span className={styles.statValue}>{h.stoneName ?? `#${h.holeValue}`}</span>
            </div>
          ))}
        </div>
      )}

      {body.properties.length > 0 && (
        <div className={styles.detailsBlock}>
          <h4>Свойства</h4>
          {body.properties.map((p, i) => {
            const flags = [p.isEmbed && 'инкрустация', p.isSuite && 'сет', p.isEngraved && 'гравировка'].filter(Boolean) as string[]
            return (
              <div key={i} className={styles.propertyRow}>
                <span className={styles.propertyName}>
                  {p.addonName ?? `addon #${p.addonId}`}
                  {flags.length > 0 && <span className={styles.propertyFlags}>{flags.map((f) => `[${f}]`).join(' ')}</span>}
                </span>
                <span className={styles.propertyValue}>{p.displayValue ?? p.computedValue?.toString() ?? '—'}</span>
              </div>
            )
          })}
        </div>
      )}

      {body.soul && (
        <div className={styles.detailsBlock}>
          <h4>Душа{body.soul.soulItemName ? `: ${body.soul.soulItemName}` : ''}</h4>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Фаза</span>
            <span className={styles.statValue}>{body.soul.unlockedPhase}/{body.soul.maxPhase}</span>
          </div>
          {body.soul.phaseStats.length > 0 && body.soul.phaseStats.map((s, i) => (
            <div key={i} className={styles.propertyRow}>
              <span className={styles.propertyName}>{s.addonName ?? `addon #${s.addonId}`}</span>
              <span className={styles.propertyValue}>{s.displayValue ?? s.value}</span>
            </div>
          ))}

          {body.soul.crystal && (
            <div className={styles.detailsBlock} style={{ marginTop: 'var(--space-md)' }}>
              <h4>
                Кристалл{body.soul.crystal.crystalItemName ? `: ${body.soul.crystal.crystalItemName}` : ''}
                {' '}({body.soul.crystal.level} ур / ранг {body.soul.crystal.rank})
              </h4>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Свечения</span>
                <span className={styles.statValue}>
                  {body.soul.crystal.insertionOrder.map((c, i) => (
                    <span key={i} className={styles.crystalDot} style={{ background: crystalColorHex(c) }} title={crystalColorName(c)} />
                  ))}
                </span>
              </div>
              {body.soul.crystal.effects.map((e, i) => (
                <div key={i} className={styles.propertyRow}>
                  <span className={styles.propertyName}>{e.addonName ?? `addon #${e.addonId}`}</span>
                  <span className={styles.propertyValue}>{e.displayValue ?? e.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function EssenceBlock({ essence }: { essence: ItemEssence }) {
  if (essence.kind === 'weapon' && essence.weapon) {
    const w = essence.weapon
    return (
      <div className={styles.detailsBlock}>
        <h4>Базовые статы (оружие)</h4>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Физ. урон</span>
          <span className={styles.statRange}>{w.damageLowMax}–{w.damageHighMax}</span>
        </div>
        {w.magicDamageHighMax > 0 && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Маг. урон</span>
            <span className={styles.statRange}>{w.magicDamageLow}–{w.magicDamageHighMax}</span>
          </div>
        )}
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Дальность</span>
          <span className={styles.statValue}>{w.attackRange.toFixed(1)} м</span>
        </div>
        {w.levelupAddonName && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Заточка</span>
            <span className={styles.statValue}>{w.levelupAddonName}</span>
          </div>
        )}
      </div>
    )
  }

  if (essence.kind === 'armor' && essence.armor) {
    const a = essence.armor
    return (
      <div className={styles.detailsBlock}>
        <h4>Базовые статы (броня{a.isNewArmor ? ', новая' : ''})</h4>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Защита</span>
          <span className={styles.statRange}>{a.defenceLow}–{a.defenceHigh}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>HP</span>
          <span className={styles.statRange}>{a.hpEnhanceLow}–{a.hpEnhanceHigh}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>MP</span>
          <span className={styles.statRange}>{a.mpEnhanceLow}–{a.mpEnhanceHigh}</span>
        </div>
        {a.fixedBonusValue && a.fixedBonusStatName && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Бонус ★</span>
            <span className={styles.statValue}>{a.fixedBonusStatName} +{a.fixedBonusValue}</span>
          </div>
        )}
        {a.levelupAddonName && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Заточка</span>
            <span className={styles.statValue}>{a.levelupAddonName}</span>
          </div>
        )}
      </div>
    )
  }

  if (essence.kind === 'decoration' && essence.decoration) {
    const d = essence.decoration
    const lines: Array<[string, string]> = []
    if (d.damageHigh > 0) lines.push(['Физ. атака', `${d.damageLow}–${d.damageHigh}`])
    if (d.magicDamageHigh > 0) lines.push(['Маг. атака', `${d.magicDamageLow}–${d.magicDamageHigh}`])
    if (d.defenceHigh > 0) lines.push(['Защита', `${d.defenceLow}–${d.defenceHigh}`])
    return (
      <div className={styles.detailsBlock}>
        <h4>Базовые статы (украшение)</h4>
        {lines.map(([k, v]) => (
          <div key={k} className={styles.statRow}>
            <span className={styles.statLabel}>{k}</span>
            <span className={styles.statRange}>{v}</span>
          </div>
        ))}
      </div>
    )
  }

  if (essence.kind === 'poker' && essence.poker) {
    const p = essence.poker
    return (
      <div className={styles.detailsBlock}>
        <h4>Базовые статы (карта генерала)</h4>
        {p.hp > 0 && <div className={styles.statRow}><span className={styles.statLabel}>HP</span><span className={styles.statValue}>+{p.hp}</span></div>}
        {p.damage > 0 && <div className={styles.statRow}><span className={styles.statLabel}>Атака</span><span className={styles.statValue}>+{p.damage}</span></div>}
        {p.magicDamage > 0 && <div className={styles.statRow}><span className={styles.statLabel}>Маг. атака</span><span className={styles.statValue}>+{p.magicDamage}</span></div>}
        {p.defence > 0 && <div className={styles.statRow}><span className={styles.statLabel}>Защита</span><span className={styles.statValue}>+{p.defence}</span></div>}
        {p.vigour > 0 && <div className={styles.statRow}><span className={styles.statLabel}>Боев. дух</span><span className={styles.statValue}>+{p.vigour}</span></div>}
        {p.addons.length > 0 && (
          <>
            <h4 style={{ marginTop: 'var(--space-md)' }}>Аддоны карты</h4>
            {p.addons.map((a, i) => (
              <div key={i} className={styles.propertyRow}>
                <span className={styles.propertyName}>{a.addonName ?? `addon #${a.addonId}`}</span>
              </div>
            ))}
          </>
        )}
      </div>
    )
  }

  if (essence.kind === 'bible' && essence.bible) {
    return (
      <div className={styles.detailsBlock}>
        <h4>Аддоны трактата</h4>
        {essence.bible.addons.map((a, i) => (
          <div key={i} className={styles.propertyRow}>
            <span className={styles.propertyName}>{a.addonName ?? `addon #${a.addonId}`}</span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

function AstrolabeBlock({ astrolabe }: { astrolabe: NonNullable<EquipItem['astrolabe']> }) {
  return (
    <div className={styles.detailsBlock}>
      <h4>Астролябия (Lv {astrolabe.level})</h4>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Опыт</span>
        <span className={styles.statValue}>{astrolabe.experience.toLocaleString()}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Аптитуды</span>
        <span className={styles.statValue}>{astrolabe.aptitudes.join(' / ')}</span>
      </div>
      {astrolabe.addons.map((a) => (
        <div key={a.virtualSlot} className={styles.propertyRow}>
          <span className={styles.propertyName}>
            {a.isFate ? '★ ' : '☆ '}
            {a.addonName ?? `addon #${a.addonId}`}
          </span>
          <span className={styles.propertyValue}>{a.value}</span>
        </div>
      ))}
    </div>
  )
}

function AtlasBlock({ atlas }: { atlas: NonNullable<EquipItem['atlas']> }) {
  return (
    <div className={styles.detailsBlock}>
      <h4>Атлас неба и земли</h4>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Уровень</span>
        <span className={styles.statValue}>{atlas.currentLevel} / {atlas.maxLevel}</span>
      </div>
    </div>
  )
}

function CardBlock({ card }: { card: NonNullable<EquipItem['card']> }) {
  return (
    <div className={styles.detailsBlock}>
      <h4>Карта генерала</h4>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Уровень</span>
        <span className={styles.statValue}>{card.level} / {card.maxLevel}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Перерождений</span>
        <span className={styles.statValue}>{'★'.repeat(card.rebirthTimes) + '☆'.repeat(Math.max(0, 2 - card.rebirthTimes))}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Опыт</span>
        <span className={styles.statValue}>{card.exp.toLocaleString()}</span>
      </div>
    </div>
  )
}
