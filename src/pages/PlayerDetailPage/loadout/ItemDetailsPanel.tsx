import type { EquipItem, ItemEssence } from '@/shared/types/loadout'
import { ItemDescription } from '@/shared/ui/ItemDescription'
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

  // Имя красим в items.NameColor (HEX без «#»). Если бэкенд не отдал цвет —
  // оставляем дефолтный золотой из стилей (.dName). Звёзды и +заточка цвет наследуют.
  const nameColor = normalizeHexColor(item.itemNameColor)
  const nameStyle = nameColor ? { color: `#${nameColor}` } : undefined

  return (
    <div className={wrapperClass}>
      <div className={styles.dHeader}>
        {stars > 0 && <span className={styles.dStars} style={nameStyle}>{'★'.repeat(stars)}</span>}
        <span className={styles.dName} style={nameStyle}>{baseName}</span>
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

      {/* Описание из items.Description с PW-кодами цветов и \r-переносами —
          в самом низу тултипа, как на рынке. */}
      {item.itemDescription && (
        <ItemDescription
          text={decodeUnicodeEscapes(item.itemDescription) ?? ''}
          className={styles.dDescription}
        />
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

/**
 * Соответствие <c>levelupAddonType</c> (TypeNumber из item_ext_prop.txt) →
 * к какому из «базовых» статов брони/декора привязан бонус заточки.
 *
 * 200 = «Точка: Физ. атака», 201 = маг. атака, 202 = защита,
 * 203..207 = защиты от стихий, 208 = здоровье, 209 = уклонение,
 * 210 = защита от стихий (общая), 211 = физ. + маг. атака, 212 = защита + маг. защита.
 */
type ArmorRefineSlot =
  | 'defence'
  | 'hp'
  | 'metalDef'
  | 'evasion'
  | 'physAtk'
  | 'magAtk'
  | null

function refineSlotForType(type?: number): ArmorRefineSlot {
  switch (type) {
    case 200: return 'physAtk'
    case 201: return 'magAtk'
    case 202: return 'defence'
    case 203: return 'metalDef'
    case 208: return 'hp'
    case 209: return 'evasion'
    case 211: return 'physAtk'
    case 212: return 'defence'
    default: return null
  }
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
  const refineSlot = refineSlotForType(a.levelupAddonType)
  // Строки отрисовываем только если у эссенции реально есть базовое значение,
  // ИЛИ если именно сюда «уходит» бонус заточки (например, у накидки defence=0,
  // но levelupAddonType=208 → нужна строка «Здоровье» только из заточки).
  const showDefence = a.defenceHigh > 0 || refineSlot === 'defence'
  const showHp = a.hpEnhanceHigh > 0 || refineSlot === 'hp'
  const showMetalDef = a.metalDefHigh > 0 || refineSlot === 'metalDef'
  const showEvasion = a.armorEnhanceHigh > 0 || refineSlot === 'evasion'

  // Рисуем строку «{label} +base (+enhanced)» / «{label} +base» / «{label} +enhanced».
  // Если ни base, ни refine не относятся к этому стату — строка скрыта.
  const renderStatLine = (
    label: string,
    lo: number,
    hi: number,
    isRefineTarget: boolean,
  ) => {
    const hasBase = hi > 0
    if (!hasBase && !isRefineTarget) return null
    if (!hasBase && isRefineTarget && enhanced) {
      // Чистая заточка: «Здоровье +N» без «(+N)».
      return (
        <div className={styles.dRow}>
          <span className={styles.dValueBaseInline}>
            {label}{' '}
          </span>
          <span className={styles.dValueEnhanced}>+{enhanced}</span>
        </div>
      )
    }
    const baseStr = lo === hi ? `${lo}` : `${lo}–${hi}`
    return (
      <div className={styles.dRow}>
        <span className={styles.dValueBaseInline}>
          {label} +{baseStr}
        </span>
        {isRefineTarget && enhanced && (
          <span className={styles.dValueEnhanced}> (+{enhanced})</span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={styles.dRow}>
        <span>Уровень: </span>
        <span className={styles.dValueBase}>{a.level}</span>
      </div>
      {showDefence && (
        <div className={styles.dRow}>
          <span>Защита </span>
          <span className={styles.dValueBase}>
            {a.defenceLow === a.defenceHigh ? a.defenceLow : `${a.defenceLow}–${a.defenceHigh}`}
          </span>
          {refineSlot === 'defence' && enhanced && (
            <span className={styles.dValueEnhanced}> (+{enhanced})</span>
          )}
        </div>
      )}
      {showHp && renderStatLine('Здоровье', a.hpEnhanceLow, a.hpEnhanceHigh, refineSlot === 'hp')}
      {showMetalDef && renderStatLine('Магическая защита', a.metalDefLow, a.metalDefHigh, refineSlot === 'metalDef')}
      {showEvasion && renderStatLine('Уклонение', a.armorEnhanceLow, a.armorEnhanceHigh, refineSlot === 'evasion')}
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
  // 10 слотов: чётные (0/2/4/6/8) — Фатум (внешние вершины пентаграммы),
  // нечётные (1/3/5/7/9) — Судьба (внутренние точки между вершинами).
  const fateAddons = astrolabe.addons.filter((a) => a.isFate)
  const destinyAddons = astrolabe.addons.filter((a) => !a.isFate)

  // Сводный показатель в центре пентаграммы — сумма destiny-аптитуд / 100,
  // как показывает игровой UI (например, 1998 → 19.98).
  const totalAptitude = astrolabe.aptitudes.reduce((s, v) => s + v, 0)
  const centerValue = (totalAptitude / 100).toFixed(2)

  return (
    <div className={styles.dAstro}>
      <div className={styles.dAstroBlock}>
        <AstrolabePentagon
          fateBySlot={Object.fromEntries(fateAddons.map((a) => [a.virtualSlot, a]))}
          destinyBySlot={Object.fromEntries(destinyAddons.map((a) => [a.virtualSlot, a]))}
          aptitudes={astrolabe.aptitudes}
          centerValue={centerValue}
        />
        <div className={styles.dAstroAddonList}>
          {destinyAddons.map((a) => (
            <AstroAddonRow key={a.virtualSlot} addon={a} kind="destiny" />
          ))}
          {fateAddons.map((a) => (
            <AstroAddonRow key={a.virtualSlot} addon={a} kind="fate" />
          ))}
        </div>
      </div>
      <div className={styles.dAstroLevel}>
        Lv {astrolabe.level}
      </div>
    </div>
  )
}

type AstroAddon = NonNullable<EquipItem['astrolabe']>['addons'][number]

/**
 * Строка списка аддонов астролябии. Аптитуда слота показывается рядом с
 * меткой и совпадает со значением, отрисованным в соответствующей звезде
 * пентаграммы — это «ключ соответствия» для пользователя.
 */
function AstroAddonRow({ addon, kind }: { addon: AstroAddon; kind: 'destiny' | 'fate' }) {
  const aptitude = (addon.slotAptitude / 100).toFixed(2)
  const labelClass = kind === 'destiny' ? styles.dAstroLabelDestiny : styles.dAstroLabelFate
  return (
    <div className={styles.dAstroRow}>
      <span className={labelClass}>{kind === 'destiny' ? 'Судьба' : 'Фатум'}</span>
      <span className={styles.dAstroAptitudeKey}>({aptitude})</span>
      <span className={styles.dAstroAddonName}>
        {decodeUnicodeEscapes(addon.addonName) ?? `addon #${addon.addonId}`}
      </span>
      <span className={styles.dAstroValue}>{addon.displayValue ?? `+${addon.value}`}</span>
    </div>
  )
}

/** Аптитуды Фатум-слотов выводятся из adjacent destiny-аптитуд в массиве. */
const FATE_ADJ_DESTINY: Record<number, [number, number]> = {
  0: [4, 0], // между destiny slot 9 (idx 4) и slot 1 (idx 0)
  2: [0, 1], // между slot 1 и slot 3
  4: [1, 2], // между slot 3 и slot 5
  6: [2, 3], // между slot 5 и slot 7
  8: [3, 4], // между slot 7 и slot 9
}

/**
 * SVG-пентаграмма астролябии: 5 внешних звёзд Фатум (slots 0/2/4/6/8) по
 * вершинам пятиугольника и 5 внутренних звёзд Судьба (slots 1/3/5/7/9)
 * на серединах рёбер. В центре — сводный показатель.
 */
function AstrolabePentagon({
  fateBySlot,
  destinyBySlot,
  aptitudes,
  centerValue,
}: {
  fateBySlot: Record<number, AstroAddon>
  destinyBySlot: Record<number, AstroAddon>
  aptitudes: number[]
  centerValue: string
}) {
  const cx = 95
  const cy = 95
  const Router = 75
  const Rinner = 32

  const fateSlots = [0, 2, 4, 6, 8]
  const destinySlots = [1, 3, 5, 7, 9]

  // Аптитуда слота: для destiny — из массива aptitudes, для fate — сумма
  // двух соседних destiny-аптитуд (так считает игровой UI).
  const aptForDestiny = (slot: number) => {
    const idx = (slot - 1) / 2
    return aptitudes[idx]
  }
  const aptForFate = (slot: number) => {
    const adj = FATE_ADJ_DESTINY[slot]
    if (!adj) return undefined
    const [a, b] = adj
    return (aptitudes[a] ?? 0) + (aptitudes[b] ?? 0)
  }
  const formatApt = (apt?: number) =>
    apt === undefined ? '' : (apt / 100).toFixed(2)

  // Внешние вершины — Фатум (5 точек, начиная с верха, по часовой стрелке).
  const fatePoints = fateSlots.map((slot, i) => {
    const angle = (-90 + i * 72) * (Math.PI / 180)
    return {
      slot,
      x: cx + Router * Math.cos(angle),
      y: cy + Router * Math.sin(angle),
      aptitude: aptForFate(slot),
    }
  })
  // Внутренние точки — Судьба (5 точек, со сдвигом 36° от внешних).
  const destinyPoints = destinySlots.map((slot, i) => {
    const angle = (-90 + 36 + i * 72) * (Math.PI / 180)
    return {
      slot,
      x: cx + Rinner * Math.cos(angle),
      y: cy + Rinner * Math.sin(angle),
      aptitude: aptForDestiny(slot),
    }
  })

  // Линии «звезды» — каждая внешняя точка соединена с двумя несмежными
  // (даёт классическую пентаграмму).
  const starLines = fatePoints.map((p, i) => {
    const next = fatePoints[(i + 2) % fatePoints.length]
    return `${p.x},${p.y} ${next.x},${next.y}`
  })

  return (
    <svg viewBox="0 0 190 190" className={styles.dAstroSvg} aria-hidden="true">
      <defs>
        <radialGradient id="astroBg" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(91,127,245,0.18)" />
          <stop offset="70%" stopColor="rgba(91,127,245,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={Router + 8} fill="url(#astroBg)" />
      {/* Пентаграмма (звезда из 5 линий). */}
      {starLines.map((points, i) => (
        <polyline
          key={i}
          points={points}
          fill="none"
          stroke="rgba(125,206,255,0.55)"
          strokeWidth="1.2"
        />
      ))}
      {/* Центр — сводная аптитуда. */}
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize="15"
        fill="#fff"
        fontWeight="600"
      >
        {centerValue}
      </text>
      {/* Звёзды Фатум (внешние вершины) — внутри показываем аптитуду слота. */}
      {fatePoints.map((p) => {
        const a = fateBySlot[p.slot]
        const aptText = formatApt(p.aptitude)
        return (
          <g key={`f-${p.slot}`}>
            <title>{`Фатум · слот ${p.slot}${a ? ` · ${decodeUnicodeEscapes(a.addonName) ?? ''}` : ''}${aptText ? ` · апт. ${aptText}` : ''}`}</title>
            <circle
              cx={p.x}
              cy={p.y}
              r={13}
              fill="#1b1c25"
              stroke={a ? '#ff5f55' : 'rgba(255,95,85,0.35)'}
              strokeWidth="1.5"
            />
            <text
              x={p.x}
              y={p.y + 3.5}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill={a ? '#ff5f55' : 'rgba(255,95,85,0.5)'}
            >
              {aptText || p.slot}
            </text>
          </g>
        )
      })}
      {/* Звёзды Судьба (внутренние точки). */}
      {destinyPoints.map((p) => {
        const a = destinyBySlot[p.slot]
        const aptText = formatApt(p.aptitude)
        return (
          <g key={`d-${p.slot}`}>
            <title>{`Судьба · слот ${p.slot}${a ? ` · ${decodeUnicodeEscapes(a.addonName) ?? ''}` : ''}${aptText ? ` · апт. ${aptText}` : ''}`}</title>
            <circle
              cx={p.x}
              cy={p.y}
              r={11}
              fill="#1b1c25"
              stroke={a ? '#7DCEFF' : 'rgba(125,206,255,0.35)'}
              strokeWidth="1.5"
            />
            <text
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="700"
              fill={a ? '#7DCEFF' : 'rgba(125,206,255,0.5)'}
            >
              {aptText || p.slot}
            </text>
          </g>
        )
      })}
    </svg>
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

/**
 * Бэкенд хранит NameColor как 6-значный hex без «#», иногда с разными регистрами
 * или с лишними префиксами. Возвращаем «aabbcc» либо <c>null</c>, чтобы корректно
 * подставить в <c>style.color = '#aabbcc'</c>.
 */
function normalizeHexColor(input?: string): string | null {
  if (!input) return null
  const trimmed = input.trim().replace(/^#|^0x/i, '')
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) return null
  return trimmed.toLowerCase()
}
