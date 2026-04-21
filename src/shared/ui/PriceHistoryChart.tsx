import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { PriceHistoryResponse, PriceHistoryAgg, PriceHistoryHourDetailed } from '@/shared/api/pshop'
import { formatNumber } from '@/shared/utils/pshop'

interface PriceHistoryChartProps {
  data: PriceHistoryResponse
  height?: number | string
  mini?: boolean
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string | number
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '5px' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: 0, color: entry.color }}>
            {entry.name === 'sell' ? 'Продажа' : 'Покупка'}: {formatNumber(entry.value ?? null)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function PriceHistoryChart({ data, height = 300, mini = false }: PriceHistoryChartProps) {
  const chartData = useMemo(() => {
    // hourly ≤90 дней содержит гистограмму prices (PriceHistoryHourDetailed),
    // hourly 90–365 и daily — PriceHistoryAgg. Для графика используем avgPrice,
    // поэтому оба варианта обрабатываются единообразно.
    const items = data.items as (PriceHistoryAgg | PriceHistoryHourDetailed)[]
    if (items.length === 0) return []

    const keyOf = (i: PriceHistoryAgg | PriceHistoryHourDetailed) => ('day' in i ? i.day : undefined) || i.hour || ''

    const sellItems = items.filter(i => i.isSell).sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
    const buyItems = items.filter(i => !i.isSell).sort((a, b) => keyOf(a).localeCompare(keyOf(b)))

    const findNearest = (targetTime: number, lookIn: (PriceHistoryAgg | PriceHistoryHourDetailed)[], isSell: boolean) => {
      if (lookIn.length === 0) return undefined
      let left = 0
      let right = lookIn.length - 1

      while (left <= right) {
        const mid = Math.floor((left + right) / 2)
        const midTime = new Date(keyOf(lookIn[mid])).getTime()
        if (midTime === targetTime) return isSell ? lookIn[mid].minPrice : lookIn[mid].maxPrice
        if (midTime < targetTime) left = mid + 1
        else right = mid - 1
      }

      const leftDist = left < lookIn.length ? Math.abs(new Date(keyOf(lookIn[left])).getTime() - targetTime) : Infinity
      const rightDist = right >= 0 ? Math.abs(new Date(keyOf(lookIn[right])).getTime() - targetTime) : Infinity

      return leftDist < rightDist ?
          (isSell ? lookIn[left].minPrice : lookIn[left].maxPrice)
          : (isSell ? lookIn[right].minPrice : lookIn[right].maxPrice)
    }

    return items.map(item => {
      const timeStr = keyOf(item)
      const time = new Date(timeStr).getTime()
      const day = 'day' in item ? item.day : undefined
      const label = day ? new Date(day).toLocaleDateString() : (item.hour ? new Date(item.hour).toLocaleString() : '')

      const sell = item.isSell ? item.minPrice : findNearest(time, sellItems, !item.isSell)
      const buy = !item.isSell ? item.maxPrice : findNearest(time, buyItems, !item.isSell)

      return {
        time: timeStr,
        label,
        sell,
        buy
      }
    }).sort((a, b) => a.time.localeCompare(b.time))
  }, [data])

  if (chartData.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Нет данных для отображения</div>
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={mini ? { top: 0, right: 0, left: 0, bottom: 0 } : { top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBuy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          {!mini && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />}
          {!mini && (
            <XAxis
              dataKey="label"
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
          )}
          {!mini && (
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatNumber(value)}
            />
          )}
          <Tooltip
            content={mini ? <></> : <CustomTooltip />}
            shared={true}
          />
          <Area
            type="monotone"
            dataKey="sell"
            name="sell"
            stroke="var(--danger)"
            strokeWidth={mini ? 1 : 2}
            fillOpacity={1}
            fill="url(#colorSell)"
            connectNulls
            dot={false}
            activeDot={!mini}
          />
          <Area
            type="monotone"
            dataKey="buy"
            name="buy"
            stroke="var(--success)"
            strokeWidth={mini ? 1 : 2}
            fillOpacity={1}
            fill="url(#colorBuy)"
            connectNulls
            dot={false}
            activeDot={!mini}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
