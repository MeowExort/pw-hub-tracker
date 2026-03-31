import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getMatchesPerDay, getMatchesPerHour, getMatchesByDayOfWeek,
  getHeatmap, getTrends,
} from '@/shared/api/analytics'
import { getMatchPatternName, formatDate } from '@/shared/utils/format'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import s from '@/shared/styles/analytics.module.scss'

const MATCH_PATTERNS = [0, 1]
const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

type Tab = 'perDay' | 'perHour' | 'byDow' | 'heatmap' | 'trends'

const TABS: { key: Tab; label: string }[] = [
  { key: 'perDay', label: 'По дням' },
  { key: 'perHour', label: 'По часам' },
  { key: 'byDow', label: 'По дням недели' },
  { key: 'heatmap', label: 'Heatmap' },
  { key: 'trends', label: 'Тренды' },
]

export function AnalyticsTimePage() {
  const [tab, setTab] = useState<Tab>('perDay')
  const [matchPattern, setMatchPattern] = useState<number | undefined>()
  const [days, setDays] = useState(30)

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Временна́я аналитика</h1>
        <div className={s.filters}>
          {tab !== 'trends' && (
            <select
              className={s.select}
              value={matchPattern ?? ''}
              onChange={(e) => setMatchPattern(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Все форматы</option>
              {MATCH_PATTERNS.map((p) => (
                <option key={p} value={p}>{getMatchPatternName(p)}</option>
              ))}
            </select>
          )}
          <div className={s.sliderWrap}>
            <span>Дней: {days}</span>
            <input
              type="range"
              className={s.slider}
              min={1}
              max={tab === 'perHour' ? 90 : 365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${s.tab} ${tab === t.key ? s.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'perDay' && <PerDayTab matchPattern={matchPattern} days={days} />}
      {tab === 'perHour' && <PerHourTab matchPattern={matchPattern} days={days} />}
      {tab === 'byDow' && <ByDowTab matchPattern={matchPattern} days={days} />}
      {tab === 'heatmap' && <HeatmapTab matchPattern={matchPattern} days={days} />}
      {tab === 'trends' && <TrendsTab days={days} />}
    </div>
  )
}

function PerDayTab({ matchPattern, days }: { matchPattern?: number; days: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['matches-per-day', matchPattern, days],
    queryFn: () => getMatchesPerDay({ matchPattern, days }),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({ date: formatDate(d.date), count: d.count }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Матчи по дням</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
            <Area type="monotone" dataKey="count" stroke="#5b7ff5" fill="#5b7ff5" fillOpacity={0.3} name="Матчей" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PerHourTab({ matchPattern, days }: { matchPattern?: number; days: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['matches-per-hour', matchPattern, days],
    queryFn: () => getMatchesPerHour({ matchPattern, days }),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({ hour: `${d.hour}:00`, count: d.count }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Матчи по часам</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="hour" tick={{ fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
            <Bar dataKey="count" fill="#7ad97a" radius={[4, 4, 0, 0]} name="Матчей" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ByDowTab({ matchPattern, days }: { matchPattern?: number; days: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['matches-by-dow', matchPattern, days],
    queryFn: () => getMatchesByDayOfWeek({ matchPattern, days }),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({ day: DAY_NAMES[d.dayOfWeek], count: d.count }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Матчи по дням недели</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
            <Bar dataKey="count" fill="#f1c40f" radius={[4, 4, 0, 0]} name="Матчей" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function HeatmapTab({ matchPattern, days }: { matchPattern?: number; days: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['heatmap', matchPattern, days],
    queryFn: () => getHeatmap({ matchPattern, days }),
    staleTime: 5 * 60_000,
  })

  const { grid, maxCount } = useMemo(() => {
    if (!data) return { grid: [] as number[][], maxCount: 0 }
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let max = 0
    for (const entry of data) {
      g[entry.dayOfWeek][entry.hour] = entry.count
      if (entry.count > max) max = entry.count
    }
    return { grid: g, maxCount: max }
  }, [data])

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />

  const getColor = (count: number) => {
    if (maxCount === 0) return 'var(--bg-secondary)'
    const intensity = count / maxCount
    const r = Math.round(91 + (245 - 91) * intensity)
    const g = Math.round(127 * (1 - intensity))
    const b = Math.round(245 * intensity)
    return `rgba(${r}, ${g}, ${b}, ${0.15 + intensity * 0.85})`
  }

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Heatmap активности</h2>
      <div className={s.heatmap}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className={s.heatmapHourLabel}>{h}</div>
        ))}
        {grid.map((row, dow) => (
          <>
            <div key={`label-${dow}`} className={s.heatmapLabel}>{DAY_NAMES[dow]}</div>
            {row.map((count, hour) => (
              <div
                key={`${dow}-${hour}`}
                className={s.heatmapCell}
                style={{ background: getColor(count) }}
                title={`${DAY_NAMES[dow]} ${hour}:00 — ${count} матчей`}
              >
                {count > 0 ? count : ''}
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  )
}

function TrendsTab({ days }: { days: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['trends', days],
    queryFn: () => getTrends(days),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({ date: formatDate(d.date), matches: d.matches, teams: d.teams, players: d.players }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Тренды</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
            <Legend />
            <Line type="monotone" dataKey="matches" stroke="#5b7ff5" name="Матчи" dot={false} />
            <Line type="monotone" dataKey="teams" stroke="#7ad97a" name="Команды" dot={false} />
            <Line type="monotone" dataKey="players" stroke="#ff6b6b" name="Игроки" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
