import type { EquipItem, ItemEssence } from '@/shared/types/loadout'
import { crystalColorHex, crystalColorName, decodeUnicodeEscapes } from './equipmentSlots'
import styles from './LoadoutSection.module.scss'

interface Props {
  item: EquipItem
  /** В <c>true</c> — без обёртки .detailsPanel (используется внутри tooltip-а). */
  embedded?: boolean
}

export function ItemDetailsPanel({ item, embedded }: Props) {
  const wrapperClass = embedded ? styles.detailsEmbedded : styles.detailsPanel
  const refine = refineLevel(item)
  const holesCount = item.body?.holes?.length ?? 0
  const decodedName = decodeUnicodeEscapes(item.itemName)
  const stars = leadingStars(decodedName)
  const baseName = decodedName ? stripLeadingStars(decodedName) : `#${item.itemId}`
  const refineAddonId = essenceLevelupAddonId(item.essence)

  return (
    <div className={wrapperClass}>
      <div className={styles.dHeader}>
        {stars > 0 && <span className={styles.dStars}>{'★'.repeat(stars)}</span>}
        <span className={styles.dName}>{baseName}</span>
        {holesCount > 0 && <span className={styles.dCells}>(ячеек: {holesCount})</span>}
        {refine !== null && refine > 0 && <span className={styles.dRefine}>+{refine}</span>}
      </div>

      <div className={styles.dBound}>Предмет привязан к персонажу</div>

      {item.essence?.kind === 'weapon' && item.essence.weapon && (
        <CoreLineWeapon w={item.essence.weapon} item={item} refineAddonId={refineAddonId} />
      )}
      {item.essence?.kind === 'armor' && item.essence.armor && (
        <CoreLineArmor a={item.essence.armor} item={item} refineAddonId={refineAddonId} />
      )}
      {item.essence?.kind === 'decoration' && item.essence.decoration && (
        <CoreLineDecoration d={item.essence.decoration} item={item} refineAddonId={refineAddonId} />
      )}

      {/* Постоянный ★-бонус для NEW_ARMOR грейда 18 */}
      {item.essence?.kind === 'armor' && item.essence.armor?.fixedBonusValue && (
        <div className={styles.dEngraved}>
          {item.essence.armor.fixedBonusStatName ?? 'Бонус'} +{item.essence.armor.fixedBonusValue}
        </div>
      )}

      {item.body?.levelRequirement !== undefined && item.body.maxEndurance > 0 && (
        <div className={styles.dRow}>
          <span>Прочность:</span>{' '}
          <span className={styles.dValueBase}>
            {item.body.currentEndurance}/{item.body.maxEndurance}
          </span>
        </div>
      )}

      <Requirements item={item} />

      {/* Свойства предмета (если нет души) */}
      {item.body && !item.body.soul && item.body.properties.length > 0 && (
        <PropertiesBlock item={item} refineAddonId={refineAddonId} />
      )}

      {/* Душа + её аддоны */}
      {item.body?.soul && (
        <SoulBlock soul={item.body.soul} />
      )}

      {/* Кристалл */}
      {item.body?.soul?.crystal && (
        <CrystalBlock crystal={item.body.soul.crystal} />
      )}

      {/* Свойства предмета (после души/кристалла, если душа есть) */}
      {item.body?.soul && item.body.properties.length > 0 && (
        <PropertiesBlock item={item} refineAddonId={refineAddonId} />
      )}

      {/* Камни в гнёздах. Имя — из items.Name (StoneName), а характеристика+значение —
          из соответствующего item-property с IsEmbed=true: AddonName и Param0. Порядок
          embed-свойств в bодиданных всегда соответствует порядку гнёзд. */}
      {item.body?.holes && item.body.holes.length > 0 && (
        <div className={styles.dStones}>
          {item.body.holes.map((h, i) => {
            const embed = embedAt(item, i)
            const stoneName = decodeUnicodeEscapes(h.stoneName) ?? `Камень #${h.holeValue}`
            const addonName = embed
              ? decodeUnicodeEscapes(embed.addonName) ?? `addon #${embed.addonId}`
              : null
            const value = embed
              ? embed.displayValue ?? (embed.computedValue !== undefined ? `+${embed.computedValue}` : '')
              : null
            return (
              <div key={i} className={styles.dStone}>
                {stoneName}
                {addonName && <span className={styles.dStoneAddon}> · {addonName} {value}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Гравировки золотым */}
      {item.body?.properties && hasEngraved(item.body.properties) && (
        <div className={styles.dEngravings}>
          {item.body.properties.filter((p) => p.isEngraved).map((p, i) => (
            <div key={i}>
              {decodeUnicodeEscapes(p.addonName) ?? `addon #${p.addonId}`}{' '}
              {p.displayValue ?? (p.computedValue !== undefined ? `+${p.computedValue}` : '')}
            </div>
          ))}
        </div>
      )}

      {/* Астролябия — звёзды судьбы + аддоны */}
      {item.astrolabe && <AstrolabeBlock astrolabe={item.astrolabe} />}
      {item.atlas && <AtlasBlock atlas={item.atlas} />}
      {item.card && <CardBlock card={item.card} essence={item.essence} />}
      {/* Трактат: список аддонов «имя + значение» из bible-эссенции. */}
      {item.essence?.kind === 'bible' && item.essence.bible && (
        <BibleBlock bible={item.essence.bible} />
      )}

      {item.body?.makerName && (
        <div className={styles.dMaker}>
          Создатель: {decodeUnicodeEscapes(item.body.makerName)}
        </div>
      )}
    </div>
  )
}

function CoreLineWeapon({
  w,
  item,
  refineAddonId,
}: {
  w: NonNullable<ItemEssence['weapon']>
  item: EquipItem
  refineAddonId: number | null
}) {
  const enhanced = enhancedValue(item, refineAddonId)
  return (
    <>
      <div className={styles.dRow}>
        <span>Уровень: </span>
        <span className={styles.dValueBase}>{w.weaponLevel || w.requireLevel}</span>
      </div>
      <div className={styles.dRow}>
        <span>Физическая атака </span>
        <span className={styles.dValueBase}>
          {w.damageLowMax}–{w.damageHighMax}
        </span>
        {enhanced && <span className={styles.dValueEnhanced}> (+{enhanced})</span>}
      </div>
      {w.magicDamageHighMax > 0 && (
        <div className={styles.dRow}>
          <span>Магическая атака </span>
          <span className={styles.dValueBase}>
            {w.magicDamageLow}–{w.magicDamageHighMax}
          </span>
        </div>
      )}
      <div className={styles.dRow}>
        <span>Дальность: </span>
        <span className={styles.dValueBase}>{w.attackRange.toFixed(2)}</span>
      </div>
    </>
  )
}

function CoreLineArmor({
  a,
  item,
  refineAddonId,
}: {
  a: NonNullable<ItemEssence['armor']>
  item: EquipItem
  refineAddonId: number | null
}) {
  const enhanced = enhancedValue(item, refineAddonId)
  return (
    <>
      <div className={styles.dRow}>
        <span>Уровень: </span>
        <span className={styles.dValueBase}>{a.level}</span>
      </div>
      <div className={styles.dRow}>
        <span>Защита </span>
        <span className={styles.dValueBase}>
          {a.defenceLow === a.defenceHigh ? a.defenceLow : `${a.defenceLow}–${a.defenceHigh}`}
        </span>
        {enhanced && <span className={styles.dValueEnhanced}> (+{enhanced})</span>}
      </div>
      {a.hpEnhanceHigh > 0 && (
        <div className={styles.dRow}>
          <span className={styles.dValueBaseInline}>
            Здоровье +{a.hpEnhanceLow === a.hpEnhanceHigh ? a.hpEnhanceLow : `${a.hpEnhanceLow}–${a.hpEnhanceHigh}`}
          </span>
        </div>
      )}
      {a.metalDefHigh > 0 && (
        <div className={styles.dRow}>
          <span className={styles.dValueBaseInline}>
            Магическая защита +{a.metalDefLow === a.metalDefHigh ? a.metalDefLow : `${a.metalDefLow}–${a.metalDefHigh}`}
          </span>
        </div>
      )}
    </>
  )
}

function CoreLineDecoration({
  d,
  item,
  refineAddonId,
}: {
  d: NonNullable<ItemEssence['decoration']>
  item: EquipItem
  refineAddonId: number | null
}) {
  const enhanced = enhancedValue(item, refineAddonId)
  const lines: Array<[string, number, number]> = []
  if (d.defenceHigh > 0) lines.push(['Защита', d.defenceLow, d.defenceHigh])
  if (d.damageHigh > 0) lines.push(['Физическая атака', d.damageLow, d.damageHigh])
  if (d.magicDamageHigh > 0) lines.push(['Магическая атака', d.magicDamageLow, d.magicDamageHigh])
  return (
    <>
      <div className={styles.dRow}>
        <span>Уровень: </span>
        <span className={styles.dValueBase}>{d.level}</span>
      </div>
      {lines.map(([label, lo, hi], i) => (
        <div key={i} className={styles.dRow}>
          <span>{label} </span>
          <span className={styles.dValueBase}>
            {lo === hi ? `+${lo}` : `+${lo}–${hi}`}
          </span>
          {i === 0 && enhanced && <span className={styles.dValueEnhanced}> (+{enhanced})</span>}
        </div>
      ))}
    </>
  )
}

function Requirements({ item }: { item: EquipItem }) {
  const body = item.body
  if (!body) return null
  const reqs: string[] = []
  if (body.levelRequirement) reqs.push(`Требуемый уровень: ${body.levelRequirement}`)
  if (body.strengthRequirement) reqs.push(`Требуемая сила: ${body.strengthRequirement}`)
  if (body.agilityRequirement) reqs.push(`Требуемая ловкость: ${body.agilityRequirement}`)
  if (body.energyRequirement) reqs.push(`Требуемый интеллект: ${body.energyRequirement}`)
  if (body.vitalityRequirement) reqs.push(`Требуемая выносл.: ${body.vitalityRequirement}`)
  if (reqs.length === 0) return null
  return (
    <div className={styles.dReqs}>
      {reqs.map((r) => (
        <div key={r}>{r}</div>
      ))}
    </div>
  )
}

function PropertiesBlock({
  item,
  refineAddonId,
}: {
  item: EquipItem
  refineAddonId: number | null
}) {
  const props = item.body?.properties ?? []
  const lines = props
    .filter((p) => !p.isEmbed && !p.isEngraved)
    // Аддон заточки рисуется только как "+N" в базовых статах, не в общем списке.
    .filter((p) => refineAddonId === null || p.addonId !== refineAddonId)
  if (lines.length === 0) return null
  return (
    <div className={styles.dAddons}>
      {lines.map((p, i) => (
        <div key={i} className={styles.dAddonBasic}>
          {decodeUnicodeEscapes(p.addonName) ?? `addon #${p.addonId}`}{' '}
          {p.displayValue ?? (p.computedValue !== undefined ? `+${p.computedValue}` : '')}
        </div>
      ))}
    </div>
  )
}

function SoulBlock({ soul }: { soul: NonNullable<NonNullable<EquipItem['body']>['soul']> }) {
  const phaseLabel = soul.unlockedPhase > 0 ? `фаза ${phaseName(soul.unlockedPhase)} ${soul.maxPhase} ранга` : null
  const decodedSoulName = decodeUnicodeEscapes(soul.soulItemName)
  const title = decodedSoulName
    ? `[${stripLeadingStars(decodedSoulName)}${phaseLabel ? ` - ${phaseLabel}` : ''}]`
    : '[Душа]'
  return (
    <div className={styles.dSoul}>
      <div className={styles.dSoulTitle}>{title}</div>
      {soul.phaseStats.map((s, i) => (
        <div key={i} className={styles.dAddonBasic}>
          {decodeUnicodeEscapes(s.addonName) ?? `addon #${s.addonId}`} {s.displayValue ?? `+${s.value}`}
        </div>
      ))}
    </div>
  )
}

function CrystalBlock({
  crystal,
}: {
  crystal: NonNullable<NonNullable<NonNullable<EquipItem['body']>['soul']>['crystal']>
}) {
  const stars = '★'.repeat(Math.max(crystal.rank, 1))
  const colorName = crystalColorName(crystal.baseColor)
  const title = decodeUnicodeEscapes(crystal.crystalItemName) ?? `Кристалл (ур.${crystal.level})`
  // Цвет названия кристалла = базовый цвет самого кристалла (красн./зел./син./лил./жёлт.).
  const titleColor = crystalColorHex(crystal.baseColor)
  return (
    <div className={styles.dCrystal}>
      <div className={styles.dCrystalTitle} style={{ color: titleColor }}>
        [ {stars} {colorName} {stripLeadingStars(title)} ]
      </div>
      {crystal.effects.map((e, i) => {
        // Эффекты кристалла бывают двух типов:
        //  - "название умения N ур." с описанием (skill-like) → красный, дальше курсив с переносом.
        //  - простой стат (Бонус к уровню +6 / Боевой дух +20) → красный, в строку.
        const name = decodeUnicodeEscapes(e.addonName) ?? `addon #${e.addonId}`
        const value = e.displayValue ?? `+${e.value}`
        return (
          <div key={i} className={styles.dCrystalAddon}>{name} {value}</div>
        )
      })}
      {crystal.insertionOrder.length > 0 && (
        <div className={styles.dCrystalDots}>
          {crystal.insertionOrder.map((c, i) => (
            <span
              key={i}
              className={styles.crystalDot}
              style={{ background: crystalColorHex(c) }}
              title={crystalColorName(c)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AstrolabeBlock({ astrolabe }: { astrolabe: NonNullable<EquipItem['astrolabe']> }) {
  // 5 «звёзд судьбы» (Fate, чётные индексы 0/2/4/6/8) — внешний круг.
  const fateAddons = astrolabe.addons.filter((a) => a.isFate)
  const destinyAddons = astrolabe.addons.filter((a) => !a.isFate)
  return (
    <div className={styles.dAstro}>
      <div className={styles.dAstroFateRow}>
        {Array.from({ length: 5 }).map((_, i) => {
          const a = fateAddons[i]
          return (
            <div key={i} className={styles.dAstroFate} title={a?.addonName}>
              <span className={styles.dAstroFateStar}>★</span>
              {a && <span className={styles.dAstroFateValue}>{a.value}</span>}
            </div>
          )
        })}
      </div>
      <div className={styles.dAstroLevel}>
        Lv {astrolabe.level} · Аптитуды: {astrolabe.aptitudes.join(' / ')}
      </div>
      {destinyAddons.length > 0 && (
        <div className={styles.dAstroDestiny}>
          {destinyAddons.map((a) => (
            <div key={a.virtualSlot} className={styles.dAstroDestinyRow}>
              <span className={styles.dAstroSlotLabel}>Судьба</span>
              <span className={styles.dAstroAddonName}>
                {decodeUnicodeEscapes(a.addonName) ?? `addon #${a.addonId}`} +{a.value}
              </span>
              <span className={styles.dAstroAptitude}>(апт. {a.slotAptitude})</span>
            </div>
          ))}
        </div>
      )}
      {fateAddons.length > 0 && (
        <div className={styles.dAstroDestiny}>
          {fateAddons.map((a) => (
            <div key={a.virtualSlot} className={styles.dAstroDestinyRow}>
              <span className={styles.dAstroSlotLabelFate}>Фатум</span>
              <span className={styles.dAstroAddonName}>
                {decodeUnicodeEscapes(a.addonName) ?? `addon #${a.addonId}`} +{a.value}
              </span>
              <span className={styles.dAstroAptitude}>(апт. {a.slotAptitude})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AtlasBlock({ atlas }: { atlas: NonNullable<EquipItem['atlas']> }) {
  return (
    <div className={styles.dRow}>
      <span>Атлас </span>
      <span className={styles.dValueBase}>{atlas.currentLevel}/{atlas.maxLevel}</span>
    </div>
  )
}

function CardBlock({
  card,
  essence,
}: {
  card: NonNullable<EquipItem['card']>
  essence?: ItemEssence
}) {
  const poker = essence?.poker
  const rankLabel = cardRankLabel(card.rank)
  const typeLabel = cardTypeLabel(poker?.subType ?? card.type)

  // Прирост от уровня: base + (level - 1) * inc.
  // Перерождения дают мультипликатор: 1 + 0.25 * rebirthTimes (приближение к игровой формуле).
  const lvlMul = Math.max(card.level - 1, 0)
  const rbMul = 1 + 0.25 * card.rebirthTimes
  const calc = (base: number, inc: number) =>
    Math.floor((base + inc * lvlMul) * rbMul)

  const statRows: Array<[string, number]> = []
  if (poker) {
    if (poker.hp > 0 || poker.incHp > 0) statRows.push(['Здоровье', calc(poker.hp, poker.incHp)])
    if (poker.damage > 0 || poker.incDamage > 0) statRows.push(['Физ. атака', calc(poker.damage, poker.incDamage)])
    if (poker.magicDamage > 0 || poker.incMagicDamage > 0) statRows.push(['Маг. атака', calc(poker.magicDamage, poker.incMagicDamage)])
    if (poker.defence > 0 || poker.incDefence > 0) statRows.push(['Защита', calc(poker.defence, poker.incDefence)])
    if (poker.metalDef > 0 || poker.incMetalDef > 0) statRows.push(['Защита от металла', calc(poker.metalDef, poker.incMetalDef)])
    if (poker.woodDef > 0 || poker.incWoodDef > 0) statRows.push(['Защита от дерева', calc(poker.woodDef, poker.incWoodDef)])
    if (poker.waterDef > 0 || poker.incWaterDef > 0) statRows.push(['Защита от воды', calc(poker.waterDef, poker.incWaterDef)])
    if (poker.fireDef > 0 || poker.incFireDef > 0) statRows.push(['Защита от огня', calc(poker.fireDef, poker.incFireDef)])
    if (poker.earthDef > 0 || poker.incEarthDef > 0) statRows.push(['Защита от земли', calc(poker.earthDef, poker.incEarthDef)])
    if (poker.vigour > 0 || poker.incVigour > 0) statRows.push(['Боевой дух', calc(poker.vigour, poker.incVigour)])
  }

  const addons = (poker?.addons ?? []).filter((a) => a.addonId)

  return (
    <div className={styles.dCard}>
      {(rankLabel || typeLabel) && (
        <div className={styles.dCardHeader}>
          {rankLabel && <span className={styles.dCardRank}>[{rankLabel}]</span>}
          {typeLabel && <span className={styles.dCardType}>{typeLabel}</span>}
        </div>
      )}
      <div className={styles.dRow}>
        <span>Уровень: </span>
        <span className={styles.dValueBase}>{card.level}/{poker?.maxLevel ?? card.maxLevel}</span>
      </div>
      {card.rebirthTimes > 0 && (
        <div className={styles.dRow}>
          <span>Перерождений: </span>
          <span className={styles.dValueBase}>{'★'.repeat(card.rebirthTimes)} ({card.rebirthTimes})</span>
        </div>
      )}
      {statRows.length > 0 && (
        <div className={styles.dCardStats}>
          {statRows.map(([label, value]) => (
            <div key={label} className={styles.dRow}>
              <span>{label}: </span>
              <span className={styles.dValueBase}>+{value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {addons.length > 0 && (
        <div className={styles.dCardAddons}>
          {addons.map((a, i) => {
            const name = decodeUnicodeEscapes(a.addonName) ?? `addon #${a.addonId}`
            const value = a.displayValue
              ?? (a.value !== undefined && a.value !== 0 ? `+${a.value}` : '')
            return (
              <div key={i} className={styles.dAddonBasic}>
                {name}{value ? ` ${value}` : ''}
              </div>
            )
          })}
        </div>
      )}
      {(poker?.requireLevel ?? card.requireLevel) > 0 && (
        <div className={styles.dReqs}>
          <div>Требуемый уровень: {poker?.requireLevel ?? card.requireLevel}</div>
          {card.requireLeadership > 0 && (
            <div>Требуемое лидерство: {card.requireLeadership}</div>
          )}
        </div>
      )}
      <div className={styles.dRow}>
        <span>Опыт: </span>
        <span className={styles.dValueBase}>{card.exp.toLocaleString()}</span>
        {poker && poker.swallowExp > 0 && (
          <span className={styles.dCardSwallow}> · поглощение {poker.swallowExp.toLocaleString()}</span>
        )}
      </div>
    </div>
  )
}

function BibleBlock({
  bible,
}: {
  bible: NonNullable<ItemEssence['bible']>
}) {
  const addons = bible.addons.filter((a) => a.addonId)
  if (addons.length === 0) return null
  return (
    <div className={styles.dCardAddons}>
      {addons.map((a, i) => {
        const name = decodeUnicodeEscapes(a.addonName) ?? `addon #${a.addonId}`
        const value = a.displayValue
          ?? (a.value !== undefined && a.value !== 0 ? `+${a.value}` : '')
        return (
          <div key={i} className={styles.dAddonBasic}>
            {name}{value ? ` ${value}` : ''}
          </div>
        )
      })}
    </div>
  )
}

function cardRankLabel(rank: number): string {
  // Игровые ранги карт: 1..5+. Разные сервера используют разные обозначения,
  // здесь применяем распространённую схему: 1=C, 2=B, 3=A, 4=S, 5=S+, 6+=SS+.
  const map: Record<number, string> = { 1: 'C', 2: 'B', 3: 'A', 4: 'S', 5: 'S+' }
  if (rank <= 0) return ''
  if (rank > 5) return `${'S'.repeat(rank - 4)}+`
  return map[rank] ?? String(rank)
}

function cardTypeLabel(subType: number): string {
  // Типы карт-генералов в RU-локализации Perfect World.
  // Если сервер вернул другое значение — показываем «Тип N».
  const map: Record<number, string> = {
    1: 'Разрушение',
    2: 'Уничтожение',
    3: 'Долголетие',
    4: 'Здоровье',
    5: 'Тайна',
    6: 'Загадка',
  }
  if (!subType) return ''
  return map[subType] ?? `Тип ${subType}`
}

// ── helpers ─────────────────────────────────────────────────────────

function refineLevel(item: EquipItem): number | null {
  if (!item.body?.properties?.length) return null
  for (const p of item.body.properties) {
    if (
      p.params.length >= 2 &&
      p.params[1] >= 0 &&
      p.params[1] <= 12 &&
      !p.isEmbed &&
      !p.isEngraved
    ) {
      return p.params[1]
    }
  }
  return null
}

/** Бонус заточки — params[0] для аддона, addonId которого совпадает с levelupAddonId эссенции. */
function enhancedValue(item: EquipItem, refineAddonId: number | null): number | null {
  if (!refineAddonId || !item.body?.properties) return null
  const p = item.body.properties.find((x) => x.addonId === refineAddonId)
  if (!p || p.params.length === 0) return null
  return p.params[0]
}

function essenceLevelupAddonId(essence?: ItemEssence): number | null {
  if (!essence) return null
  return (
    essence.weapon?.levelupAddonId ??
    essence.armor?.levelupAddonId ??
    essence.decoration?.levelupAddonId ??
    null
  )
}

function leadingStars(name?: string): number {
  if (!name) return 0
  let n = 0
  while (n < name.length && name[n] === '★') n++
  return n
}

function stripLeadingStars(name?: string): string {
  if (!name) return ''
  let i = 0
  while (i < name.length && name[i] === '★') i++
  return name.slice(i).trim()
}

function hasEngraved(props: NonNullable<EquipItem['body']>['properties']): boolean {
  return props.some((p) => p.isEngraved)
}

/**
 * Возвращает i-ое свойство-«embed» (камень в гнезде) из тела предмета. Серверный
 * парсер сохраняет порядок embed-свойств идентично порядку <c>Holes</c>, так что
 * можно сопоставлять по индексу.
 */
function embedAt(item: EquipItem, index: number) {
  const props = item.body?.properties
  if (!props) return undefined
  let n = 0
  for (const p of props) {
    if (!p.isEmbed) continue
    if (n === index) return p
    n++
  }
  return undefined
}

function phaseName(phase: number): string {
  const names: Record<number, string> = { 1: 'солнца', 2: 'звезды', 3: 'луны', 4: 'кометы', 5: 'затмения' }
  return names[phase] ?? String(phase)
}
