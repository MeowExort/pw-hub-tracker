import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { ScoreHistoryItem } from '@/shared/types/api'
import { formatDate } from '@/shared/utils/format'
import styles from './TeamDetailPage.module.scss'

/** Пропсы графика рейтинга */
interface ScoreChartProps {
  /** Данные истории рейтинга */
  data: ScoreHistoryItem[]
}

/** График истории рейтинга */
export function ScoreChart({ data }: ScoreChartProps) {
  const chartData = data.map((item) => ({
    date: formatDate(item.recordedAt),
    score: item.score,
  }))

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
