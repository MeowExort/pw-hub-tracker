import { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from 'recharts'
import type { Sparkline } from '@/shared/api/pshop'
import { formatNumber } from '@/shared/utils/pshop'

interface SparklineChartProps {
  data: Sparkline
  height?: number | string
  /** true — без осей/подсказок (для tooltip/таблиц), false — с YAxis и tooltip. */
  mini?: boolean
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string | number
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '12px',
      }}
    >
      <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '4px' }}>
        {typeof label === 'string' ? new Date(label).toLocaleString() : label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: 0, color: entry.color }}>
          {entry.name === 'sell' ? 'Продажа' : 'Покупка'}: {formatNumber(entry.value ?? null)}
        </p>
      ))}
    </div>
  )
}

/**
 * Лёгкий график на основе облегчённого Sparkline-контракта (B1/B2/B4).
 * В отличие от PriceHistoryChart, не требует PriceHistoryResponse и работает
 * с уже агрегированными sell/buy медианами по бакетам.
 */
export function SparklineChart({ data, height = 80, mini = true }: SparklineChartProps) {
  const chartData = useMemo(
    () =>
      data.points.map((p) => ({
        time: p.ts,
        sell: p.sellMedian ?? undefined,
        buy: p.buyMedian ?? undefined,
      })),
    [data],
  )

  const hasAny = chartData.some((p) => p.sell !== undefined || p.buy !== undefined)
  if (!hasAny) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 12,
        }}
      >
        Нет данных
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={mini ? { top: 0, right: 0, left: 0, bottom: 0 } : { top: 4, right: 4, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="spkSell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="spkBuy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {!mini && (
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
          )}
          <Tooltip content={mini ? <></> : <CustomTooltip />} shared />
          <Area
            type="monotone"
            dataKey="sell"
            name="sell"
            stroke="var(--danger)"
            strokeWidth={mini ? 1 : 2}
            fill="url(#spkSell)"
            connectNulls
            dot={false}
            activeDot={!mini}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="buy"
            name="buy"
            stroke="var(--success)"
            strokeWidth={mini ? 1 : 2}
            fill="url(#spkBuy)"
            connectNulls
            dot={false}
            activeDot={!mini}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
