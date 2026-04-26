/**
 * Раскладка слотов экипировки в стиле игрового UI Perfect World.
 * Сетка 7 колонок × 4 ряда: col1-3 = левая часть, col4 = силуэт персонажа,
 * col5-7 = правая часть. Соответствует <c>EQUIP_INDEX_*</c> из <c>item.h</c>.
 *
 * ```
 *   col1  col2  col3   col4(char)   col5  col6  col7
 * ┌──────┬──────┬──────┬──────────┬──────┬──────┬──────┐
 * │  20  │  21  │  12  │          │  24  │   1  │  19  │
 * ├──────┼──────┼──────┤          ├──────┼──────┼──────┤
 * │   2  │   3  │  18  │  силуэт  │  26  │   4  │   ·  │
 * ├──────┼──────┼──────┤  персон. ├──────┼──────┼──────┤
 * │   8  │   5  │  22  │          │   ·  │   6  │   0  │
 * ├──────┼──────┼──────┤          ├──────┼──────┼──────┤
 * │   9  │  10  │  23  │          │  38  │   7  │  11  │
 * └──────┴──────┴──────┴──────────┴──────┴──────┴──────┘
 * ```
 *
 * Под основной сеткой:
 *   • Карты генерала: 32, 33, 34, 35, 36, 37
 *   • Стиль:          29, 13, 14, 15, 16, 25
 *
 * Значение `-1` в раскладке — зарезервированная пустота (col занят, но
 * экипировки в этом месте у класса нет, например слот 7 у Лучника).
 */

const SLOT_LABELS: Record<number, string> = {
  0: 'Оружие',
  1: 'Шлем',
  2: 'Ожерелье',
  3: 'Плечи',
  4: 'Броня',
  5: 'Ремень',
  6: 'Штаны',
  7: 'Ботинки',
  8: 'Наручи',
  9: 'Кольцо 1',
  10: 'Кольцо 2',
  11: 'Стрелы',
  12: 'Накидка',
  13: 'Стиль головы',
  14: 'Стиль тела',
  15: 'Стиль ног',
  16: 'Стиль накидки',
  18: 'Трактат',
  19: 'Кулон',
  20: 'Амулет',
  21: 'Идол',
  22: 'Феечка',
  23: 'Джинн',
  24: 'Лавка',
  25: 'Причёска',
  26: 'Атлас',
  29: 'Полёт',
  32: 'Карта 1',
  33: 'Карта 2',
  34: 'Карта 3',
  35: 'Карта 4',
  36: 'Карта 5',
  37: 'Карта 6',
  38: 'Астролябия',
}

export function slotLabel(index: number): string {
  return SLOT_LABELS[index] ?? `Слот ${index}`
}

export interface MainSlotConfig {
  /** EQUIP_INDEX_* или -1 для зарезервированной пустоты. */
  index: number
  row: number  // 1..4
  col: number  // 1..7 (col 4 — силуэт)
}

/**
 * Раскладка основной сетки экипировки. Подписи берутся из <see cref="slotLabel"/>.
 * Порядок задан построчно (слева → силуэт → справа), как просил пользователь.
 */
export const MAIN_LAYOUT: MainSlotConfig[] = [
  // Row 1
  { index: 20, row: 1, col: 1 },
  { index: 21, row: 1, col: 2 },
  { index: 12, row: 1, col: 3 },
  { index: 24, row: 1, col: 5 },
  { index: 1,  row: 1, col: 6 },
  { index: 19, row: 1, col: 7 },

  // Row 2
  { index: 2,  row: 2, col: 1 },
  { index: 3,  row: 2, col: 2 },
  { index: 18, row: 2, col: 3 },
  { index: 26, row: 2, col: 5 },
  { index: 4,  row: 2, col: 6 },
  { index: -1, row: 2, col: 7 },

  // Row 3
  { index: 8,  row: 3, col: 1 },
  { index: 5,  row: 3, col: 2 },
  { index: 22, row: 3, col: 3 },
  { index: -1, row: 3, col: 5 },
  { index: 6,  row: 3, col: 6 },
  { index: 0,  row: 3, col: 7 },

  // Row 4
  { index: 9,  row: 4, col: 1 },
  { index: 10, row: 4, col: 2 },
  { index: 23, row: 4, col: 3 },
  { index: 38, row: 4, col: 5 },
  { index: 7,  row: 4, col: 6 },
  { index: 11, row: 4, col: 7 },
]

/** Слоты карт генерала (нижний ряд №1). */
export const POKER_SLOTS: number[] = [32, 33, 34, 35, 36, 37]

/** Слоты стилей / костюмов (нижний ряд №2). */
export const STYLE_SLOTS: number[] = [29, 13, 14, 15, 16, 25]

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
