/**
 * Раскладка слотов экипировки в стиле игрового UI Perfect World.
 * Сетка 5 колонок × 4 ряда: col1-2 = левая часть, col3 = силуэт персонажа,
 * col4-5 = правая часть. Соответствует <c>EQUIP_INDEX_*</c> из <c>item.h</c>.
 *
 * ```
 *   col1     col2     col3        col4      col5
 * ┌────────┬────────┬──────────┬────────┬────────┐
 * │ Полёт  │        │          │        │ Шлем   │
 * │ s29    │        │          │        │ s1     │
 * ├────────┼────────┤ силуэт   ├────────┼────────┤
 * │ Ожер.  │ Накид. │ персон.  │        │ Броня  │
 * │ s2     │ s12    │          │        │ s4     │
 * ├────────┼────────┤          ├────────┼────────┤
 * │ Наручи │ Ремень │          │ Штаны  │ Оружие │
 * │ s8     │ s5     │          │ s6     │ s0     │
 * ├────────┼────────┤          ├────────┼────────┤
 * │ Кольцо │ Кольцо │          │ Астро. │ Ботин. │
 * │ s9     │ s10    │          │ s38    │ s7     │
 * └────────┴────────┴──────────┴────────┴────────┘
 * ```
 *
 * Под основной сеткой — ряды:
 *   • Спец-слоты (Трактат s18, Атлас s26)
 *   • Карты генерала (s32..37)
 */

export interface MainSlotConfig {
  index: number
  label: string
  row: number  // 1..4
  col: number  // 1, 2, 4, 5
}

export const MAIN_LAYOUT: MainSlotConfig[] = [
  { index: 29, label: 'Полёт', row: 1, col: 1 },
  { index: 1, label: 'Шлем', row: 1, col: 5 },
  { index: 2, label: 'Ожерелье', row: 2, col: 1 },
  { index: 12, label: 'Накидка', row: 2, col: 2 },
  { index: 4, label: 'Броня', row: 2, col: 5 },
  { index: 8, label: 'Наручи', row: 3, col: 1 },
  { index: 5, label: 'Ремень', row: 3, col: 2 },
  { index: 6, label: 'Штаны', row: 3, col: 4 },
  { index: 0, label: 'Оружие', row: 3, col: 5 },
  { index: 9, label: 'Кольцо 1', row: 4, col: 1 },
  { index: 10, label: 'Кольцо 2', row: 4, col: 2 },
  { index: 38, label: 'Астролябия', row: 4, col: 4 },
  { index: 7, label: 'Ботинки', row: 4, col: 5 },
]

export interface SpecialSlotConfig {
  index: number
  label: string
}

/** Спец-слоты под основной сеткой. */
export const SPECIAL_SLOTS: SpecialSlotConfig[] = [
  { index: 18, label: 'Трактат' },
  { index: 26, label: 'Атлас' },
]

/** Слоты карт генерала. */
export const POKER_SLOTS: SpecialSlotConfig[] = [
  { index: 32, label: 'Карта 1' },
  { index: 33, label: 'Карта 2' },
  { index: 34, label: 'Карта 3' },
  { index: 35, label: 'Карта 4' },
  { index: 36, label: 'Карта 5' },
  { index: 37, label: 'Карта 6' },
]

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
