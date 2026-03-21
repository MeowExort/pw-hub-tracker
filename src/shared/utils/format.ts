/** Названия классов персонажей */
const CLASS_NAMES: Record<number, string> = {
  0: 'Воин',
  1: 'Маг',
  2: 'Шаман',
  3: 'Друид',
  4: 'Оборотень',
  5: 'Убийца',
  6: 'Лучник',
  7: 'Жрец',
  8: 'Страж',
  9: 'Мистик',
  10: 'Призрак',
  11: 'Жнец',
  12: 'Стрелок',
  13: 'Паладин',
  14: 'Странник',
  15: 'Бард',
  16: 'Дух крови'
}

/** Получить название класса по ID */
export function getClassName(cls: number): string {
  return CLASS_NAMES[cls] ?? `Класс ${cls}`
}

/** Названия паттернов матчей */
const MATCH_PATTERN_NAMES: Record<number, string> = {
  0: 'Порядок',
  1: 'Хаос',
}

/** Получить название паттерна матча */
export function getMatchPatternName(pattern: number): string {
  return MATCH_PATTERN_NAMES[pattern] ?? `Тип ${pattern}`
}

/** Форматировать дату */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Форматировать дату и время */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Форматировать timestamp (секунды) в дату */
export function formatTimestamp(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Вычислить винрейт */
export function calcWinRate(wins: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((wins / total) * 100)}%`
}

/** Форматировать изменение рейтинга */
export function formatScoreDelta(before: number | null, after: number | null): string {
  if (before === null || after === null) return '—'
  const delta = after - before
  if (delta > 0) return `+${delta}`
  return String(delta)
}
