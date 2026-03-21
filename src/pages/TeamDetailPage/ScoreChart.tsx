import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import type { ScoreHistoryItem } from '@/shared/types/api'
import { formatDate, formatDateTime } from '@/shared/utils/format'
import styles from './TeamDetailPage.module.scss'

/** Пропсы графика рейтинга */
interface ScoreChartProps {
  /** Данные истории рейтинга */
  data: ScoreHistoryItem[]
  /** Количество участников команды (для деления рейтинга) */
  memberCount?: number
}

/** График истории рейтинга */
export function ScoreChart({ data, memberCount }: ScoreChartProps) {
  const chartData = useMemo(() => {
    const divisor = memberCount && memberCount > 0 ? memberCount : 1

    // Каждая запись — отдельная точка, данные разворачиваем (старые первые)
    return [...data].reverse().map((item, index) => {
      const score = Math.round(item.score / divisor)
      return {
        index,
        date: formatDate(item.recordedAt),
        datetime: formatDateTime(item.recordedAt),
        chaos: item.matchPattern === 1 ? score : undefined,
        order: item.matchPattern === 0 ? score : undefined,
      }
    })
  }, [data, memberCount])

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="index"
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            tickFormatter={(index: number) => chartData[index]?.date ?? ''}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(_label, payload) => {
              if (payload?.[0]?.payload?.datetime) return payload[0].payload.datetime
              return _label
            }}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="chaos"
            name="Хаос"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#22c55e' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="order"
            name="Порядок"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
