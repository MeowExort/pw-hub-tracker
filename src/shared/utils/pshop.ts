/** Форматирование числа с разделителями тысяч */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('ru-RU')
}

/** Форматирование даты ISO в читаемый вид */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Форматирование секунд в читаемое время */
export function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)} сек`
  if (s < 3600) return `${Math.round(s / 60)} мин`
  return `${(s / 3600).toFixed(1)} ч`
}

/** Форматирование unix timestamp в дату */
export function formatUnixDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Название типа магазина */
export function shopTypeName(type: number): string {
  switch (type) {
    case 1: return 'Продажа'
    case 2: return 'Скупка'
    case 3: return 'Смешанный'
    default: return `Тип ${type}`
  }
}

/** Дата N дней назад в ISO */
export function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}
