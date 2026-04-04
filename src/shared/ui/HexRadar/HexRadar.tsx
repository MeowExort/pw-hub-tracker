import styles from './HexRadar.module.scss'

export interface HexRadarAxis {
  label: string
  value: number
  max: number
}

interface HexRadarProps {
  axes: HexRadarAxis[]
  size?: number
}

const LABEL_OFFSET = 14

/** SVG-шестиугольник силы (radar chart) */
export function HexRadar({ axes, size = 140 }: HexRadarProps) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - LABEL_OFFSET - 4
  const n = axes.length
  if (n < 3) return null

  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2

  const point = (i: number, ratio: number) => {
    const a = startAngle + i * angleStep
    return { x: cx + r * ratio * Math.cos(a), y: cy + r * ratio * Math.sin(a) }
  }

  const gridLevels = [0.25, 0.5, 0.75, 1]

  const gridPolygons = gridLevels.map((level) =>
    axes.map((_, i) => point(i, level)).map((p) => `${p.x},${p.y}`).join(' '),
  )

  const dataPoints = axes.map((axis, i) => {
    const ratio = axis.max > 0 ? Math.min(axis.value / axis.max, 1) : 0
    return point(i, Math.max(ratio, 0.03))
  })
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  const labelPoints = axes.map((_, i) => {
    const a = startAngle + i * angleStep
    return { x: cx + (r + LABEL_OFFSET) * Math.cos(a), y: cy + (r + LABEL_OFFSET) * Math.sin(a) }
  })

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={styles.svg}>
        {gridPolygons.map((pts, i) => (
          <polygon key={i} points={pts} className={styles.grid} />
        ))}
        {axes.map((_, i) => {
          const p = point(i, 1)
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} className={styles.axis} />
        })}
        <polygon points={dataPolygon} className={styles.data} />
        {labelPoints.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className={styles.label}
          >
            {axes[i].label}
          </text>
        ))}
      </svg>
    </div>
  )
}
