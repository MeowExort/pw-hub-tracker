import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  getServersOverview, getServersAverageScore, getServersPlayerStats,
  getServerSummary,
} from '@/shared/api/analytics'
import { getClassName, getClassIcon, getMatchPatternName } from '@/shared/utils/format'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import s from '@/shared/styles/analytics.module.scss'

const MATCH_PATTERNS = [0, 1]
const COLORS = [
  '#5b7ff5', '#7ad97a', '#ff6b6b', '#f1c40f', '#e67e22', '#9b59b6',
  '#1abc9c', '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#8e44ad',
  '#00bcd4', '#ff5722', '#607d8b', '#795548', '#cddc39',
]

type Tab = 'overview' | 'avgScore' | 'playerStats' | 'summary'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Обзор серверов' },
  { key: 'avgScore', label: 'Средний рейтинг' },
  { key: 'playerStats', label: 'Характеристики' },
  { key: 'summary', label: 'Сводка по серверу' },
]

export function AnalyticsServersPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [matchPattern, setMatchPattern] = useState<number | undefined>()
  const [selectedServer, setSelectedServer] = useState('')

  const handleServerClick = (server: string) => {
    setSelectedServer(server)
    setTab('summary')
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Серверная аналитика</h1>
        <div className={s.filters}>
          {tab === 'avgScore' && (
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
          {tab === 'summary' && (
            <input
              className={s.input}
              placeholder="Сервер (напр. s1)"
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
            />
          )}
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

      {tab === 'overview' && <OverviewTab onServerClick={handleServerClick} />}
      {tab === 'avgScore' && <AvgScoreTab matchPattern={matchPattern} />}
      {tab === 'playerStats' && <PlayerStatsTab />}
      {tab === 'summary' && <SummaryTab server={selectedServer} />}
    </div>
  )
}

function OverviewTab({ onServerClick }: { onServerClick: (server: string) => void }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['servers-overview'],
    queryFn: getServersOverview,
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  return (
    <div className={s.serverCards}>
      {data.map((srv) => (
        <div key={srv.server} className={s.serverCard} onClick={() => onServerClick(srv.server)}>
          <div className={s.serverName}>{srv.server}</div>
          <div className={s.serverStat}>Игроков: {srv.players}</div>
          <div className={s.serverStat}>Участий в матчах: {srv.matchParticipations}</div>
        </div>
      ))}
    </div>
  )
}

function AvgScoreTab({ matchPattern }: { matchPattern?: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['servers-avg-score', matchPattern],
    queryFn: () => getServersAverageScore(matchPattern),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({
    name: d.server,
    avg: Math.round(d.averageScore),
    min: d.minScore,
    max: d.maxScore,
  }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Средний рейтинг по серверам</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
            <Legend />
            <Bar dataKey="min" fill="#ff6b6b" name="Мин" />
            <Bar dataKey="avg" fill="#5b7ff5" name="Средний" />
            <Bar dataKey="max" fill="#7ad97a" name="Макс" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PlayerStatsTab() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['servers-player-stats'],
    queryFn: getServersPlayerStats,
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message="Не удалось загрузить данные" onRetry={() => refetch()} />
  if (!data?.length) return <p>Нет данных</p>

  const chartData = data.map((d) => ({
    name: d.server,
    HP: Math.round(d.avgHp),
    Attack: Math.round(d.avgAttack),
    Defense: Math.round(d.avgDefense),
    Armor: Math.round(d.avgArmor),
    CritRate: Math.round(d.avgCritRate * 10) / 10,
    PeakGrade: Math.round(d.avgPeakGrade * 10) / 10,
  }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Сравнение характеристик игроков по серверам</h2>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
            <Legend />
            <Bar dataKey="HP" fill="#5b7ff5" />
            <Bar dataKey="Attack" fill="#ff6b6b" />
            <Bar dataKey="Defense" fill="#7ad97a" />
            <Bar dataKey="Armor" fill="#f1c40f" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SummaryTab({ server }: { server: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['server-summary', server],
    queryFn: () => getServerSummary(server),
    enabled: !!server,
    staleTime: 5 * 60_000,
  })

  if (!server) return <p>Введите название сервера или выберите из обзора</p>
  if (isLoading) return <div className={s.center}><Spinner /></div>
  if (error) return <ErrorMessage message={`Сервер «${server}» не найден`} onRetry={() => refetch()} />
  if (!data) return null

  const classDist = data.classDistribution.map((d) => ({
    name: getClassName(d.cls),
    value: d.count,
  }))

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Сводка: {data.server}</h2>

      <div className={s.statsGrid}>
        <div className={s.statCard}>
          <div className={s.statValue}>{data.playerCount}</div>
          <div className={s.statLabel}>Всего игроков</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statValue}>{data.arenaPlayerCount}</div>
          <div className={s.statLabel}>Игроков арены</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statValue}>{data.matchCount}</div>
          <div className={s.statLabel}>Матчей</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statValue}>{Math.round(data.averageScore)}</div>
          <div className={s.statLabel}>Средний рейтинг</div>
        </div>
      </div>

      <h3 className={s.cardTitle}>Распределение классов</h3>
      <div className={s.chartWrap}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={classDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%"
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {classDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {data.topPlayers.length > 0 && (
        <>
          <h3 className={s.cardTitle}>Топ-10 игроков</h3>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Класс</th>
                <th>Рейтинг</th>
                <th>Формат</th>
                <th>Побед</th>
                <th>Боёв</th>
              </tr>
            </thead>
            <tbody>
              {data.topPlayers.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <img src={getClassIcon(p.cls)} alt="" style={{ width: 16, height: 16, marginRight: 4, verticalAlign: 'middle' }} />
                    {getClassName(p.cls)}
                  </td>
                  <td>{p.score}</td>
                  <td>{getMatchPatternName(p.matchPattern)}</td>
                  <td>{p.winCount}</td>
                  <td>{p.battleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
