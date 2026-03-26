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

/** Иконки классов персонажей */
const CLASS_ICONS: Record<number, string> = {
  0: '/assets/classes/var.png',
  1: '/assets/classes/mag.png',
  2: '/assets/classes/sham.png',
  3: '/assets/classes/dru.png',
  4: '/assets/classes/tank.png',
  5: '/assets/classes/sin.png',
  6: '/assets/classes/luk.png',
  7: '/assets/classes/prist.png',
  8: '/assets/classes/sik.png',
  9: '/assets/classes/mist.png',
  10: '/assets/classes/gost.png',
  11: '/assets/classes/kosa.png',
  12: '/assets/classes/gan.png',
  13: '/assets/classes/pal.png',
  14: '/assets/classes/mk.png',
  15: '/assets/classes/bard.png',
  16: '/assets/classes/dk.png',
}

/** Получить путь к иконке класса */
export function getClassIcon(cls: number): string {
  return CLASS_ICONS[cls] ?? ''
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

/** Названия серверов по zoneId */
const SERVER_NAMES: Record<number, string> = {
  2: 'Центавр',
  3: 'Фенрир',
  5: 'Мицар',
  29: 'Капелла',
}

/** Получить название сервера по zoneId */
export function getServerName(zoneId: number): string {
  return SERVER_NAMES[zoneId] ?? `Сервер ${zoneId}`
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

/** Форматировать имя игрока */
export function formatPlayerName(id: number, name?: string | null): string {
  return name ? name : `Без имени (${id})`
}

/** Форматировать изменение рейтинга */
export function formatScoreDelta(before: number | null, after: number | null): string {
  if (before === null || after === null) return '—'
  const delta = after - before
  if (delta > 0) return `+${delta}`
  return String(delta)
}
