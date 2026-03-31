import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import {
  getPlayerCard, comparePlayers, getPropertyHistory,
  getStatsDistribution, getWinrateCorrelation,
  type PlayerCard, type PlayerCompare,
} from '@/shared/api/analytics'
import { getClassName, getMatchPatternName, formatDateTime } from '@/shared/utils/format'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import s from '@/shared/styles/analytics.module.scss'

const MATCH_PATTERNS = [0, 1]

const RADAR_KEYS: { key: keyof PlayerCard['properties']; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'armor', label: 'Armor' },
  { key: 'critRate', label: 'CritRate' },
  { key: 'attackSpeed', label: 'AtkSpeed' },
  { key: 'peakGrade', label: 'PeakGrade' },
  { key: 'vigour', label: 'Vigour' },
]

const STAT_OPTIONS = [
  'Hp', 'Mp', 'Attack', 'Defense', 'Armor', 'DamageLow', 'DamageHigh',
  'DamageMagicLow', 'DamageMagicHigh', 'AttackSpeed', 'CritRate',
  'DamageReduce', 'PeakGrade', 'Vigour', 'AttackDegree', 'DefendDegree',
]

const CORRELATION_STATS = [
  'Hp', 'Mp', 'Attack', 'Defense', 'Armor', 'DamageLow', 'DamageHigh',
  'CritRate', 'PeakGrade', 'Vigour', 'AttackDegree', 'DefendDegree',
]

const HISTORY_KEYS = [
  'hp', 'mp', 'damageLow', 'damageHigh', 'damageMagicLow', 'damageMagicHigh',
  'defense', 'attack', 'armor', 'attackSpeed', 'critRate', 'damageReduce',
  'peakGrade', 'vigour', 'attackDegree', 'defendDegree',
] as const

const LINE_COLORS = [
  '#5b7ff5', '#7ad97a', '#ff6b6b', '#f1c40f', '#e67e22', '#9b59b6',
  '#1abc9c', '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#8e44ad',
  '#00bcd4', '#ff5722', '#607d8b', '#795548',
]

type Tab = 'card' | 'compare' | 'history' | 'statsDist' | 'correlation'

const TABS: { key: Tab; label: string }[] = [
  { key: 'card', label: 'Карточка игрока' },
  { key: 'compare', label: 'Сравнение' },
  { key: 'history', label: 'История прокачки' },
  { key: 'statsDist', label: 'Распределение по классам' },
  { key: 'correlation', label: 'Корреляция' },
]

export function AnalyticsPlayersPage() {
  const [tab, setTab] = useState<Tab>('card')

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Характеристики игроков</h1>
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

      {tab === 'card' && <CardTab />}
      {tab === 'compare' && <CompareTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'statsDist' && <StatsDistTab />}
      {tab === 'correlation' && <CorrelationTab />}
    </div>
  )
}

function CardTab() {
  const [server, setServer] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [search, setSearch] = useState<{ server: string; id: number } | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['player-card', search?.server, search?.id],
    queryFn: () => getPlayerCard(search!.server, search!.id),
    enabled: !!search,
    staleTime: 5 * 60_000,
  })

  const handleSearch = () => {
    if (server && playerId) setSearch({ server, id: Number(playerId) })
  }

  const radarData = useMemo(() => {
    if (!data) return []
    const props = data.properties
    const maxVals: Record<string, number> = {
      hp: 100000, attack: 30000, defense: 20000, armor: 20000,
      critRate: 100, attackSpeed: 5, peakGrade: 100, vigour: 500,
    }
    return RADAR_KEYS.map((k) => ({
      stat: k.label,
      value: props[k.key] as number,
      normalized: ((props[k.key] as number) / (maxVals[k.key] || 1)) * 100,
    }))
  }, [data])

  return (
    <div className={s.card}>
      <div className={s.filters}>
        <input className={s.input} placeholder="Сервер" value={server} onChange={(e) => setServer(e.target.value)} />
        <input className={s.input} placeholder="ID игрока" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
        <button className={s.tab} onClick={handleSearch}>Найти</button>
      </div>

      {isLoading && <div className={s.center}><Spinner /></div>}
      {error && <ErrorMessage message="Игрок не найден" onRetry={() => refetch()} />}

      {data && (
        <>
          <h2 className={s.cardTitle}>{data.name} — {getClassName(data.cls)} ({data.server})</h2>
          <div className={s.radarWrap}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar name={data.name} dataKey="normalized" stroke="#5b7ff5" fill="#5b7ff5" fillOpacity={0.3} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  formatter={(_, __, props) => {
                    const p = props.payload as { value: number; stat: string }
                    return [p.value, p.stat]
                  }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {data.battleStats.length > 0 && (
            <>
              <h3 className={s.cardTitle}>Боевая статистика</h3>
              <table className={s.table}>
                <thead>
                  <tr><th>Формат</th><th>Рейтинг</th><th>Побед</th><th>Боёв</th><th>Винрейт</th></tr>
                </thead>
                <tbody>
                  {data.battleStats.map((bs) => (
                    <tr key={bs.matchPattern}>
                      <td>{getMatchPatternName(bs.matchPattern)}</td>
                      <td>{bs.score}</td>
                      <td>{bs.winCount}</td>
                      <td>{bs.battleCount}</td>
                      <td>{bs.winRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}

function CompareTab() {
  const [p1Server, setP1Server] = useState('')
  const [p1Id, setP1Id] = useState('')
  const [p2Server, setP2Server] = useState('')
  const [p2Id, setP2Id] = useState('')
  const [search, setSearch] = useState<{ p1s: string; p1i: number; p2s: string; p2i: number } | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['player-compare', search],
    queryFn: () => comparePlayers(search!.p1s, search!.p1i, search!.p2s, search!.p2i),
    enabled: !!search,
    staleTime: 5 * 60_000,
  })

  const handleCompare = () => {
    if (p1Server && p1Id && p2Server && p2Id) {
      setSearch({ p1s: p1Server, p1i: Number(p1Id), p2s: p2Server, p2i: Number(p2Id) })
    }
  }

  const COMPARE_KEYS: (keyof PlayerCompare)[] = [
    'hp', 'mp', 'attack', 'defense', 'armor', 'damageLow', 'damageHigh',
    'critRate', 'attackSpeed', 'peakGrade', 'vigour', 'attackDegree', 'defendDegree',
    'damageReduce', 'antiDefenseDegree', 'antiResistanceDegree',
  ]

  const radarData = useMemo(() => {
    if (!data || data.length < 2) return []
    const maxVals: Record<string, number> = {
      hp: 100000, mp: 50000, attack: 30000, defense: 20000, armor: 20000,
      critRate: 100, attackSpeed: 5, peakGrade: 100, vigour: 500,
      damageLow: 15000, damageHigh: 20000, attackDegree: 200, defendDegree: 200,
      damageReduce: 100, antiDefenseDegree: 200, antiResistanceDegree: 200,
    }
    return RADAR_KEYS.map((k) => {
      const key = k.key as keyof PlayerCompare
      const max = maxVals[key as string] || 1
      return {
        stat: k.label,
        [data[0].name]: ((data[0][key] as number) / max) * 100,
        [data[1].name]: ((data[1][key] as number) / max) * 100,
      }
    })
  }, [data])

  return (
    <div className={s.card}>
      <div className={s.filters}>
        <input className={s.input} placeholder="Сервер 1" value={p1Server} onChange={(e) => setP1Server(e.target.value)} />
        <input className={s.input} placeholder="ID 1" value={p1Id} onChange={(e) => setP1Id(e.target.value)} />
        <input className={s.input} placeholder="Сервер 2" value={p2Server} onChange={(e) => setP2Server(e.target.value)} />
        <input className={s.input} placeholder="ID 2" value={p2Id} onChange={(e) => setP2Id(e.target.value)} />
        <button className={s.tab} onClick={handleCompare}>Сравнить</button>
      </div>

      {isLoading && <div className={s.center}><Spinner /></div>}
      {error && <ErrorMessage message="Один или оба игрока не найдены" onRetry={() => refetch()} />}

      {data && data.length === 2 && (
        <>
          <div className={s.radarWrap}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar name={data[0].name} dataKey={data[0].name} stroke="#5b7ff5" fill="#5b7ff5" fillOpacity={0.2} />
                <Radar name={data[1].name} dataKey={data[1].name} stroke="#ff6b6b" fill="#ff6b6b" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <table className={s.table}>
            <thead>
              <tr><th>Характеристика</th><th>{data[0].name}</th><th>{data[1].name}</th></tr>
            </thead>
            <tbody>
              {COMPARE_KEYS.map((key) => {
                const v1 = data[0][key] as number
                const v2 = data[1][key] as number
                return (
                  <tr key={key}>
                    <td>{key}</td>
                    <td className={v1 > v2 ? s.better : v1 < v2 ? s.worse : ''}>{v1}</td>
                    <td className={v2 > v1 ? s.better : v2 < v1 ? s.worse : ''}>{v2}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

function HistoryTab() {
  const [server, setServer] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [limit, setLimit] = useState(100)
  const [search, setSearch] = useState<{ server: string; id: number } | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(['hp', 'attack', 'defense']))

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['property-history', search?.server, search?.id, limit],
    queryFn: () => getPropertyHistory(search!.server, search!.id, limit),
    enabled: !!search,
    staleTime: 5 * 60_000,
  })

  const handleSearch = () => {
    if (server && playerId) setSearch({ server, id: Number(playerId) })
  }

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const chartData = useMemo(() => {
    if (!data) return []
    return [...data].reverse().map((entry) => ({
      ...entry,
      date: formatDateTime(entry.recordedAt),
    }))
  }, [data])

  return (
    <div className={s.card}>
      <div className={s.filters}>
        <input className={s.input} placeholder="Сервер" value={server} onChange={(e) => setServer(e.target.value)} />
        <input className={s.input} placeholder="ID игрока" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
        <div className={s.sliderWrap}>
          <span>Лимит: {limit}</span>
          <input type="range" className={s.slider} min={1} max={1000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </div>
        <button className={s.tab} onClick={handleSearch}>Загрузить</button>
      </div>

      <div className={s.multiSelect}>
        {HISTORY_KEYS.map((key, i) => (
          <button
            key={key}
            className={`${s.chip} ${selectedKeys.has(key) ? s.chipActive : ''}`}
            onClick={() => toggleKey(key)}
            style={selectedKeys.has(key) ? { borderColor: LINE_COLORS[i % LINE_COLORS.length], color: LINE_COLORS[i % LINE_COLORS.length] } : undefined}
          >
            {key}
          </button>
        ))}
      </div>

      {isLoading && <div className={s.center}><Spinner /></div>}
      {error && <ErrorMessage message="Не удалось загрузить историю" onRetry={() => refetch()} />}

      {chartData.length > 0 && (
        <div className={s.chartWrap}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-secondary)' }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
              <Legend />
              {HISTORY_KEYS.filter((k) => selectedKeys.has(k)).map((key) => (
                <Line key={key} type="monotone" dataKey={key} stroke={LINE_COLORS[HISTORY_KEYS.indexOf(key) % LINE_COLORS.length]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function StatsDistTab() {
  const [stat, setStat] = useState('Hp')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stats-distribution', stat],
    queryFn: () => getStatsDistribution(stat),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />

  const chartData = data?.map((d) => ({
    name: getClassName(d.cls),
    min: d.min,
    avg: Math.round(d.average),
    max: d.max,
  })) ?? []

  return (
    <div className={s.card}>
      <div className={s.header}>
        <h2 className={s.cardTitle}>Распределение характеристик по классам</h2>
        <select className={s.select} value={stat} onChange={(e) => setStat(e.target.value)}>
          {STAT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {chartData.length > 0 && (
        <div className={s.chartWrap}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--text-secondary)' }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="min" fill="#ff6b6b" name="Мин" />
              <Bar dataKey="avg" fill="#5b7ff5" name="Среднее" />
              <Bar dataKey="max" fill="#7ad97a" name="Макс" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function CorrelationTab() {
  const [stat, setStat] = useState('Attack')
  const [matchPattern, setMatchPattern] = useState<number | undefined>()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['winrate-correlation', stat, matchPattern],
    queryFn: () => getWinrateCorrelation({ stat, matchPattern }),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />

  return (
    <div className={s.card}>
      <div className={s.header}>
        <h2 className={s.cardTitle}>Корреляция характеристик и винрейта</h2>
        <div className={s.filters}>
          <select className={s.select} value={stat} onChange={(e) => setStat(e.target.value)}>
            {CORRELATION_STATS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className={s.select} value={matchPattern ?? ''} onChange={(e) => setMatchPattern(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Все форматы</option>
            {MATCH_PATTERNS.map((p) => <option key={p} value={p}>{getMatchPatternName(p)}</option>)}
          </select>
        </div>
      </div>
      {data && data.length > 0 && (
        <div className={s.chartWrap}>
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="statValue" name={stat} tick={{ fill: 'var(--text-secondary)' }} />
              <YAxis type="number" dataKey="winRate" name="Винрейт" unit="%" tick={{ fill: 'var(--text-secondary)' }} domain={[0, 100]} />
              <ZAxis range={[30, 30]} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                formatter={(value, name) => [String(name) === 'Винрейт' ? `${Number(value).toFixed(1)}%` : value, String(name)]}
              />
              <Scatter data={data} fill="#5b7ff5" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
