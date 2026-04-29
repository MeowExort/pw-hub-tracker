/**
 * Раскладка слотов экипировки в стиле игрового UI Perfect World.
 * Сетка: col1-3 = левая часть, col4 = декоративный разделитель (см. SCSS),
 * col5-7 = правая часть. Соответствует <c>EQUIP_INDEX_*</c> из <c>item.h</c>.
 *
 * ```
 *   col1  col2  col3   ░░  col5  col6  col7
 * ┌──────┬──────┬──────┬──┬──────┬──────┬──────┐
 * │  20  │  21  │  12  │░░│  24  │   1  │  19  │
 * ├──────┼──────┼──────┤░░├──────┼──────┼──────┤
 * │   2  │   3  │  18  │░░│  26  │   4  │   ·  │
 * ├──────┼──────┼──────┤░░├──────┼──────┼──────┤
 * │   8  │   5  │  22  │░░│   ·  │   6  │   0  │
 * ├──────┼──────┼──────┤░░├──────┼──────┼──────┤
 * │   9  │  10  │  23  │░░│  38  │   7  │  11  │
 * └──────┴──────┴──────┴──┴──────┴──────┴──────┘
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
  17: 'Стиль оружия',
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
  col: number  // 1..7 (col 1-3 левая часть, col 4 — разделитель, col 5-7 правая)
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
export const STYLE_SLOTS: number[] = [29, 13, 14, 15, 16, 17, 25]

/**
 * URL CDN-иконки предмета. Для отображения в UI берём upscale-вариант
 * 56×56 — он чётче на ретине и в сетке экипировки. Базовый размер
 * <c>https://cdn.pw-hub.ru/items/icons/&lt;id&gt;.webp</c> остаётся
 * залит, но в UI больше не используется.
 */
export function itemIconUrl(itemId?: number): string | undefined {
  if (!itemId || itemId <= 0) return undefined
  return `https://cdn.pw-hub.ru/items/icons/upscale/56/${itemId}.webp`
}

/**
 * Бэкенд иногда отдаёт строки с экранированными `\u****` (например имена
 * предметов с ★). Здесь декодируем их в реальные unicode-символы.
 * Поддерживается также суррогатная пара `\uD83D\uDE00`.
 */
export function decodeUnicodeEscapes(input?: string): string | undefined {
  if (!input) return input
  if (input.indexOf('\\u') < 0) return input
  return input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}

/**
 * Универсальный «addon-like»-объект: всё, что мы умеем рендерить как
 * «&lt;имя&gt; &lt;значение&gt;» — item-property, soul-phase-stat,
 * crystal-effect, astrolabe-addon, card-addon, bible-addon. Поля
 * перечислены по убыванию приоритета формирования значения.
 */
export interface AddonLike {
  addonId?: number
  addonName?: string
  /** Только у item-property — массив сырых параметров аддона. */
  params?: number[]
  /** Уже отформатированное значение от бэкенда (содержит знак, %, и т.п.). */
  displayValue?: string
  /** Численное «вычисленное» значение (для случаев, когда displayValue нет). */
  computedValue?: number
  /** Сырое serverValue/value (последний фолбэк). */
  value?: number
}

export interface FormattedAddon {
  name: string
  value: string
}

/**
 * Готовит пару «имя · значение» для аддона по правилам отображения,
 * договорённым в UI:
 *
 *   • Имя с суффиксом `(%)` («Урон навыков (%)») — `(%)` снимаем,
 *     а к значению дописываем `%` (если процента ещё нет в строке).
 *     То есть «Урон навыков (%) +5» → «Урон навыков +5%».
 *
 *   • Аддон с именем `Заоблачное умение` — значимое значение лежит
 *     не в displayValue, а в `params[1]`. Печатаем `+params[1]`.
 *
 *   • Иначе значение берётся в порядке: `displayValue` →
 *     `+computedValue` → `+value`.
 */
export function formatAddonDisplay(a: AddonLike): FormattedAddon {
  const decoded =
    decodeUnicodeEscapes(a.addonName)
    ?? (a.addonId !== undefined ? `addon #${a.addonId}` : '')

  let name = decoded
  let value: string

  if (decoded === 'Заоблачное умение' && a.params && a.params.length >= 2) {
    value = `+${a.params[1]}`
  } else if (a.displayValue !== undefined) {
    value = a.displayValue
  } else if (a.computedValue !== undefined) {
    value = `+${a.computedValue}`
  } else if (a.value !== undefined) {
    value = `+${a.value}`
  } else {
    value = ''
  }

  if (name.endsWith('(%)')) {
    name = name.slice(0, -3).trimEnd()
    if (value && !value.includes('%')) value = `${value}%`
  }

  return { name, value }
}

const CRYSTAL_COLOR_NAMES = ['Красный', 'Зелёный', 'Синий', 'Лиловый', 'Жёлтый']
const CRYSTAL_COLOR_HEX = ['#ff6b6b', '#7ad97a', '#5b7ff5', '#b06bff', '#f1c40f']

export function crystalColorName(value: number): string {
  return CRYSTAL_COLOR_NAMES[value] ?? `#${value}`
}

export function crystalColorHex(value: number): string {
  return CRYSTAL_COLOR_HEX[value] ?? '#888'
}
