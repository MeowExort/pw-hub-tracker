import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  getClassDistribution, getClassWinrate, getClassAverageScore,
  getPopularCompositions, getBestCompositions,
} from '@/shared/api/analytics'
import { getClassName, getMatchPatternName } from '@/shared/utils/format'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import s from '@/shared/styles/analytics.module.scss'

const MATCH_PATTERNS = [0, 1]
const COLORS = [
  '#5b7ff5', '#7ad97a', '#ff6b6b', '#f1c40f', '#e67e22', '#9b59b6',
  '#1abc9c', '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#8e44ad',
  '#00bcd4', '#ff5722', '#607d8b', '#795548', '#cddc39',
]

type Tab = 'distribution' | 'winrate' | 'avgScore' | 'popular' | 'best'

const TABS: { key: Tab; label: string }[] = [
  { key: 'distribution', label: 'Распределение' },
  { key: 'winrate', label: 'Винрейт' },
  { key: 'avgScore', label: 'Средний рейтинг' },
  { key: 'popular', label: 'Популярные составы' },
  { key: 'best', label: 'Лучшие составы' },
]

export function AnalyticsClassesPage() {
  const [tab, setTab] = useState<Tab>('distribution')
  const [matchPattern, setMatchPattern] = useState<number | undefined>()
  const [limit, setLimit] = useState(20)
  const [minMatches, setMinMatches] = useState(5)

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Аналитика по классам</h1>
        <div className={s.filters}>
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

      {tab === 'distribution' && <DistributionTab matchPattern={matchPattern} />}
      {tab === 'winrate' && <WinrateTab matchPattern={matchPattern} />}
      {tab === 'avgScore' && <AvgScoreTab matchPattern={matchPattern} />}
      {tab === 'popular' && <PopularTab matchPattern={matchPattern} limit={limit} setLimit={setLimit} />}
      {tab === 'best' && <BestTab matchPattern={matchPattern} limit={limit} setLimit={setLimit} minMatches={minMatches} setMinMatches={setMinMatches} />}
    </div>
  )
}

function DistributionTab({ matchPattern }: { matchPattern?: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['class-distribution', matchPattern],
    queryFn: () => getClassDistribution(matchPattern),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({ name: getClassName(d.cls), count: d.count, uniquePlayers: d.uniquePlayers }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Распределение классов</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={chartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius="80%" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value, name, props) => [
              `${value} (уник: ${(props.payload as { uniquePlayers: number }).uniquePlayers})`, String(name)
            ]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function WinrateTab({ matchPattern }: { matchPattern?: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['class-winrate', matchPattern],
    queryFn: () => getClassWinrate(matchPattern),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({ name: getClassName(d.cls), winRate: d.winRate, totalMatches: d.totalMatches, wins: d.wins }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Винрейт по классам</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-secondary)' }} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)' }} width={75} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              formatter={(value, _, props) => {
                const p = props.payload as { totalMatches: number; wins: number }
                return [`${Number(value).toFixed(1)}% (${p.wins}/${p.totalMatches})`, 'Винрейт']
              }}
            />
            <Bar dataKey="winRate" fill="#5b7ff5" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AvgScoreTab({ matchPattern }: { matchPattern?: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['class-avg-score', matchPattern],
    queryFn: () => getClassAverageScore(matchPattern),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({ name: getClassName(d.cls), averageScore: Math.round(d.averageScore), playerCount: d.playerCount }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Средний рейтинг по классам</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              formatter={(value, _, props) => [
                `${value} (игроков: ${(props.payload as { playerCount: number }).playerCount})`, 'Ср. рейтинг'
              ]}
            />
            <Bar dataKey="averageScore" fill="#7ad97a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CompositionTable({ data }: { data: { composition: number[]; count: number; wins: number; winRate: number }[] }) {
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>Состав</th>
          <th>Матчей</th>
          <th>Побед</th>
          <th>Винрейт</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            <td>{row.composition.map((c) => getClassName(c)).join(', ')}</td>
            <td>{row.count}</td>
            <td>{row.wins}</td>
            <td>{row.winRate.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PopularTab({ matchPattern, limit, setLimit }: { matchPattern?: number; limit: number; setLimit: (v: number) => void }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['popular-compositions', matchPattern, limit],
    queryFn: () => getPopularCompositions({ matchPattern, limit }),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />

  return (
    <div className={s.card}>
      <div className={s.header}>
        <h2 className={s.cardTitle}>Популярные составы</h2>
        <div className={s.sliderWrap}>
          <span>Лимит: {limit}</span>
          <input type="range" className={s.slider} min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </div>
      </div>
      {data?.length ? <CompositionTable data={data} /> : <p>Нет данных</p>}
    </div>
  )
}

function BestTab({ matchPattern, limit, setLimit, minMatches, setMinMatches }: {
  matchPattern?: number; limit: number; setLimit: (v: number) => void; minMatches: number; setMinMatches: (v: number) => void
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['best-compositions', matchPattern, limit, minMatches],
    queryFn: () => getBestCompositions({ matchPattern, limit, minMatches }),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />

  return (
    <div className={s.card}>
      <div className={s.header}>
        <h2 className={s.cardTitle}>Лучшие составы</h2>
        <div className={s.filters}>
          <div className={s.sliderWrap}>
            <span>Лимит: {limit}</span>
            <input type="range" className={s.slider} min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
          <div className={s.sliderWrap}>
            <span>Мин. матчей: {minMatches}</span>
            <input type="range" className={s.slider} min={1} max={50} value={minMatches} onChange={(e) => setMinMatches(Number(e.target.value))} />
          </div>
        </div>
      </div>
      {data?.length ? <CompositionTable data={data} /> : <p>Нет данных</p>}
    </div>
  )
}
