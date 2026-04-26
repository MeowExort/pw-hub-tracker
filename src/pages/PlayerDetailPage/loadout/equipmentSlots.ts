/**
 * Раскладка слотов экипировки на «paper doll» сетке.
 * Соответствует <c>EQUIP_INDEX_*</c> из <c>server_source/cgame/gs/item.h</c>.
 *
 * Координаты — это индексы CSS-grid-cells (1-based) в layout 4×6:
 *
 * ```
 *   col1     col2     col3      col4
 * ┌────────┬────────┬─────────┬────────┐
 * │ Weapon │ Head   │ Necklace│ Should │
 * │ Body   │ Waist  │ Leg     │ Foot   │
 * │ Wrist  │ Ring1  │ Ring2   │ Cape   │
 * │ Bible  │ Atlas  │ Wing    │Astrol. │
 * │ Poker0 │ Poker1 │ Poker2  │ Poker3 │
 * │ Poker4 │ Poker5 │         │        │
 * └────────┴────────┴─────────┴────────┘
 * ```
 */

export interface SlotConfig {
  /** server_source EQUIP_INDEX_* */
  index: number
  /** короткая русская подпись (показывается под пустым слотом) */
  label: string
  /** в какой ряд ставить (1..6) */
  row: number
  /** в какую колонку ставить (1..4) */
  col: number
  /** Группа: основная экипировка, карты генерала, спец-слоты */
  group: 'main' | 'special' | 'poker'
}

export const EQUIPMENT_SLOTS: SlotConfig[] = [
  { index: 0, label: 'Оружие', row: 1, col: 1, group: 'main' },
  { index: 1, label: 'Шлем', row: 1, col: 2, group: 'main' },
  { index: 2, label: 'Ожерелье', row: 1, col: 3, group: 'main' },
  { index: 3, label: 'Плечи', row: 1, col: 4, group: 'main' },
  { index: 4, label: 'Тело', row: 2, col: 1, group: 'main' },
  { index: 5, label: 'Пояс', row: 2, col: 2, group: 'main' },
  { index: 6, label: 'Ноги', row: 2, col: 3, group: 'main' },
  { index: 7, label: 'Сапоги', row: 2, col: 4, group: 'main' },
  { index: 8, label: 'Запястья', row: 3, col: 1, group: 'main' },
  { index: 9, label: 'Кольцо', row: 3, col: 2, group: 'main' },
  { index: 10, label: 'Кольцо', row: 3, col: 3, group: 'main' },
  { index: 12, label: 'Накидка', row: 3, col: 4, group: 'main' },
  { index: 18, label: 'Трактат', row: 4, col: 1, group: 'special' },
  { index: 26, label: 'Атлас', row: 4, col: 2, group: 'special' },
  { index: 29, label: 'Крылья', row: 4, col: 3, group: 'special' },
  { index: 38, label: 'Астролябия', row: 4, col: 4, group: 'special' },
  { index: 32, label: 'Карта 1', row: 5, col: 1, group: 'poker' },
  { index: 33, label: 'Карта 2', row: 5, col: 2, group: 'poker' },
  { index: 34, label: 'Карта 3', row: 5, col: 3, group: 'poker' },
  { index: 35, label: 'Карта 4', row: 5, col: 4, group: 'poker' },
  { index: 36, label: 'Карта 5', row: 6, col: 1, group: 'poker' },
  { index: 37, label: 'Карта 6', row: 6, col: 2, group: 'poker' },
]

const SLOT_BY_INDEX = new Map<number, SlotConfig>(EQUIPMENT_SLOTS.map((s) => [s.index, s]))

export function getSlotConfig(index: number): SlotConfig | undefined {
  return SLOT_BY_INDEX.get(index)
}

/** URL CDN-иконки предмета (конвенция Pw.Hub). */
export function itemIconUrl(itemId?: number): string | undefined {
  if (!itemId || itemId <= 0) return undefined
  return `https://cdn.pw-hub.ru/items/icons/${itemId}.webp`
}

const CRYSTAL_COLOR_NAMES = ['Красный', 'Зелёный', 'Синий', 'Лиловый', 'Жёлтый']
const CRYSTAL_COLOR_HEX = ['#ff6b6b', '#7ad97a', '#5b7ff5', '#b06bff', '#f1c40f']

export function crystalColorName(value: number): string {
  return CRYSTAL_COLOR_NAMES[value] ?? `#${value}`
}

export function crystalColorHex(value: number): string {
  return CRYSTAL_COLOR_HEX[value] ?? '#888'
}

/** Звёздочки заточки реликвии (0..20). */
export function refineStars(level: number): string {
  const n = Math.max(0, Math.min(20, level))
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 12 - n))
}
