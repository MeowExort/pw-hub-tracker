/**
 * Типы для агрегированного loadout-а игрока (экипировка + руны скиллов + реликвии).
 * Соответствуют контракту `/api/players/{server}/{playerId}/loadout/*`.
 */

export interface PlayerLoadoutResponse {
  playerId: number
  server: string
  playerName?: string
  cls?: number
  gender?: number
  equipment?: EquipmentSnapshot
  skillRunes?: SkillRunesSnapshot
  soulRelics?: SoulRelicsSnapshot
}

export interface EquipmentSnapshot {
  snapshotId: number
  recordedAt: string
  items: EquipItem[]
}

export interface EquipItem {
  slotIndex: number
  itemId: number
  itemName?: string
  amount: number
  procType: number
  expireDate: number
  itemGuidHex?: string
  bodyCrc: number
  itemDataBase64?: string
  body?: ItemBody
  astrolabe?: AstrolabeBody
  atlas?: AtlasBody
  card?: CardBody
  essence?: ItemEssence
}

export interface ItemBody {
  levelRequirement: number
  professionRequirement: number
  strengthRequirement: number
  vitalityRequirement: number
  agilityRequirement: number
  energyRequirement: number
  currentEndurance: number
  maxEndurance: number
  essenceSize: number
  makerName?: string
  madeFrom: number
  stoneMask: number
  remainingBytesHex?: string
  holes: ItemHole[]
  properties: ItemProperty[]
  soul?: ItemSoul
}

export interface ItemHole {
  orderIndex: number
  holeValue: number
  stoneName?: string
}

export interface ItemProperty {
  addonId: number
  addonName?: string
  rawType: number
  isEmbed: boolean
  isSuite: boolean
  isEngraved: boolean
  params: number[]
  computedValue?: number
  displayValue?: string
}

export interface ItemSoul {
  soulItemId: number
  soulItemName?: string
  maxPhase: number
  unlockedPhase: number
  hasCrystal: boolean
  phaseStats: SoulPhaseStat[]
  crystal?: ItemCrystal
}

export interface SoulPhaseStat {
  phaseIndex: number
  addonId: number
  addonName?: string
  value: number
  computedValue?: number
  displayValue?: string
}

export interface ItemCrystal {
  crystalItemId: number
  crystalItemName?: string
  level: number
  rank: number
  baseColor: number
  counts: CrystalGlowCounts
  insertionOrder: number[]
  effects: CrystalEffect[]
}

export interface CrystalGlowCounts {
  red: number
  green: number
  blue: number
  lilac: number
  yellow: number
}

export interface CrystalEffect {
  addonId: number
  addonName?: string
  value: number
  computedValue?: number
  displayValue?: string
}

export interface AstrolabeBody {
  experience: number
  level: number
  slotMask: number
  aptitudes: number[]
  addons: AstrolabeAddon[]
}

export interface AstrolabeAddon {
  virtualSlot: number
  isFate: boolean
  addonId: number
  addonName?: string
  rawAddonId: number
  arg0: number
  slotAptitude: number
  value: number
  displayValue?: string
}

export interface AtlasBody {
  maxLevel: number
  currentLevel: number
  levelDataAHex: string
  levelDataBHex: string
  tailByte: number
}

export interface CardBody {
  type: number
  rank: number
  requireLevel: number
  requireLeadership: number
  maxLevel: number
  level: number
  exp: number
  rebirthTimes: number
}

export type EssenceKind = 'weapon' | 'armor' | 'decoration' | 'poker' | 'bible'

export interface ItemEssence {
  kind: EssenceKind
  weapon?: WeaponEssence
  armor?: ArmorEssence
  decoration?: DecorationEssence
  poker?: PokerEssence
  bible?: BibleEssence
}

export interface WeaponEssence {
  majorType: number
  subType: number
  requireProjectile: number
  requireStrength: number
  requireAgility: number
  requireEnergy: number
  requireVitality: number
  classMask: number
  requireLevel: number
  requireReputation: number
  weaponLevel: number
  fixedProps: number
  damageLowMin: number
  damageLowMax: number
  damageHighMin: number
  damageHighMax: number
  magicDamageLow: number
  magicDamageHighMin: number
  magicDamageHighMax: number
  attackRange: number
  shortRangeMode: number
  durabilityMin: number
  durabilityMax: number
  levelupAddonId?: number
  levelupAddonName?: string
  /** TypeNumber аддона заточки. */
  levelupAddonType?: number
  materialNeed: number
}

export interface ArmorEssence {
  majorType: number
  subType: number
  equipLocation: number
  level: number
  requireStrength: number
  requireAgility: number
  requireEnergy: number
  requireVitality: number
  classMask: number
  requireLevel: number
  requireReputation: number
  fixedProps: number
  defenceLow: number
  defenceHigh: number
  metalDefLow: number
  metalDefHigh: number
  woodDefLow: number
  woodDefHigh: number
  waterDefLow: number
  waterDefHigh: number
  fireDefLow: number
  fireDefHigh: number
  earthDefLow: number
  earthDefHigh: number
  mpEnhanceLow: number
  mpEnhanceHigh: number
  hpEnhanceLow: number
  hpEnhanceHigh: number
  armorEnhanceLow: number
  armorEnhanceHigh: number
  durabilityMin: number
  durabilityMax: number
  levelupAddonId?: number
  levelupAddonName?: string
  /** TypeNumber аддона заточки (200/201 = атака, 202 = защита, 208 = HP, 209 = уклонение и т.п.). */
  levelupAddonType?: number
  materialNeed: number
  isNewArmor: boolean
  fixedBonusStat?: number
  fixedBonusStatName?: string
  fixedBonusValue?: number
}

export interface DecorationEssence {
  majorType: number
  subType: number
  level: number
  requireStrength: number
  requireAgility: number
  requireEnergy: number
  requireVitality: number
  classMask: number
  requireLevel: number
  requireReputation: number
  fixedProps: number
  damageLow: number
  damageHigh: number
  magicDamageLow: number
  magicDamageHigh: number
  defenceLow: number
  defenceHigh: number
  metalDefLow: number
  metalDefHigh: number
  woodDefLow: number
  woodDefHigh: number
  waterDefLow: number
  waterDefHigh: number
  fireDefLow: number
  fireDefHigh: number
  earthDefLow: number
  earthDefHigh: number
  armorEnhanceLow: number
  armorEnhanceHigh: number
  durabilityMin: number
  durabilityMax: number
  levelupAddonId?: number
  levelupAddonName?: string
  /** TypeNumber аддона заточки. */
  levelupAddonType?: number
  materialNeed: number
}

export interface PokerEssence {
  subType: number
  requireLevel: number
  requireControlPoint1: number
  requireControlPoint2: number
  rank: number
  maxLevel: number
  hp: number
  damage: number
  magicDamage: number
  defence: number
  metalDef: number
  woodDef: number
  waterDef: number
  fireDef: number
  earthDef: number
  vigour: number
  incHp: number
  incDamage: number
  incMagicDamage: number
  incDefence: number
  incMetalDef: number
  incWoodDef: number
  incWaterDef: number
  incFireDef: number
  incEarthDef: number
  incVigour: number
  swallowExp: number
  addons: EssenceAddonRef[]
}

export interface BibleEssence {
  addons: EssenceAddonRef[]
}

export interface EssenceAddonRef {
  slot: number
  addonId?: number
  addonName?: string
  /** Шаблонное значение из addons.Param1. */
  value?: number
  /** Отформатированное значение «как в игре» (+5%, +0.10, +280 и т.п.). */
  displayValue?: string
}

export interface SkillRunesSnapshot {
  snapshotId: number
  recordedAt: string
  slots: SkillRuneSlot[]
}

export interface SkillRuneSlot {
  slot: number
  skillId: number
  skillName?: string
  runeTemplateId: number
  runeItemName?: string
}

export interface SoulRelicsSnapshot {
  snapshotId: number
  recordedAt: string
  relics: SoulRelicEntry[]
}

export interface SoulRelicEntry {
  orderIndex: number
  relicId: number
  relicName?: string
  soulLevel: number
  field2: number
  refineLevel: number
  mainSkillId: number
  mainSkillName?: string
  mainSkillValue: number
  mainSkillDisplayValue?: string
  mainA: number
  mainB: number
  extras: SoulRelicExtra[]
}

export interface SoulRelicExtra {
  slotIndex: number
  skillId: number
  skillName?: string
  level: number
  value: number
  displayValue?: string
}

export interface LoadoutTimelineEntry {
  recordedAt: string
  equipmentSnapshotId?: number
  skillRunesSnapshotId?: number
  soulRelicsSnapshotId?: number
}
