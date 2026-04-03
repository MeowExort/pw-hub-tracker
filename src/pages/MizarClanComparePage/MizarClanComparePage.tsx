import { useMemo, useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getPlayerPropertiesByIds } from '@/shared/api/players'
import type { PlayerProperty } from '@/shared/types/api'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { formatPlayerName, getClassName, getClassIcon } from '@/shared/utils/format'
import { VOIDBORN_IDS, IMPROVE_IDS } from './clans'
import styles from './MizarClanComparePage.module.scss'

/** Названия характеристик для сравнения */
const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  mp: 'MP',
  attack: 'Меткость',
  armor: 'Уклонение',
  defense: 'Защита',
  damageLow: 'Мин. физ. урон',
  damageHigh: 'Макс. физ. урон',
  damageMagicLow: 'Мин. маг. урон',
  damageMagicHigh: 'Макс. маг. урон',
  attackSpeed: 'Скорость атаки',
  runSpeed: 'Скорость бега',
  critRate: 'Крит. шанс',
  critDamageBonus: 'Крит. урон',
  attackDegree: 'ПА',
  defendDegree: 'ПЗ',
  damageReduce: 'Снижение урона?',
  vigour: 'БД',
  prayspeed: 'Пение',
  invisibleDegree: 'Скрытность',
  antiInvisibleDegree: 'Обнаружение',
  antiDefenseDegree: 'Физ пробив',
  antiResistanceDegree: 'Маг пробив',
  peakGrade: 'БУ',
}

/** Ключи характеристик для сравнения */
const COMPARE_KEYS: (keyof PlayerProperty)[] = ['attackDegree', 'defendDegree', 'vigour', 'peakGrade']

/** Вычислить сумму значений характеристики */
function calcSum(players: PlayerProperty[], key: keyof PlayerProperty): number {
  return players.reduce((acc, p) => acc + Number(p[key] ?? 0), 0)
}

/** Форматировать число */
function fmt(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('ru-RU')
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

/** Страница сравнения кланов VoidBorn и Improve */
export function MizarClanComparePage() {
  const allPlayers = useMemo(
    () => [...VOIDBORN_IDS, ...IMPROVE_IDS].map((id) => ({ Id: id, Server: 'alkor' })),
    [],
  )

  const query = useQuery({
    queryKey: ['clanCompare', 'alkor', 'properties'],
    queryFn: () => getPlayerPropertiesByIds(allPlayers),
  })

  const { voidBornPlayers, improvePlayers } = useMemo(() => {
    if (!query.data) return { voidBornPlayers: [], improvePlayers: [] }
    const voidBornSet = new Set(VOIDBORN_IDS)
    const improveSet = new Set(IMPROVE_IDS)
    return {
      voidBornPlayers: query.data.filter((p) => voidBornSet.has(p.playerId)),
      improvePlayers: query.data.filter((p) => improveSet.has(p.playerId)),
    }
  }, [query.data])

  if (query.isLoading) {
    return <div className={styles.center}><Spinner /></div>
  }

  if (query.error) {
    return <ErrorMessage message="Не удалось загрузить характеристики" onRetry={() => query.refetch()} />
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Сравнение кланов</h1>

      {/* Шапка: два клана */}
      <div className={styles.summary}>
        <div className={styles.clanCard}>
          <div className={`${styles.clanName} ${styles.voidBorn}`}>VoidBorn</div>
          <div className={styles.clanCount}>
            {voidBornPlayers.length} игроков
          </div>
        </div>
        <div className={styles.vs}>VS</div>
        <div className={styles.clanCard}>
          <div className={`${styles.clanName} ${styles.improve}`}>Improve</div>
          <div className={styles.clanCount}>
            {improvePlayers.length} игроков
          </div>
        </div>
      </div>

      {/* Таблица и суммарные характеристики */}
      <PlayersTable voidBornPlayers={voidBornPlayers} improvePlayers={improvePlayers} />
    </div>
  )
}

type TaggedPlayer = PlayerProperty & { clan: 'VoidBorn' | 'Improve' }

type SortKey = 'playerId' | 'clan' | 'playerCls' | 'hp' | 'damageTop' | 'attackDegree' | 'defendDegree' | 'vigour' | 'peakGrade' | 'critRate'
type SortDir = 'asc' | 'desc'

/** Получить верхнюю планку урона для сортировки */
function getDamageTop(p: PlayerProperty): number {
  return Math.max(p.damageHigh, p.damageMagicHigh)
}

/** Получить значение для сортировки */
function getSortValue(p: TaggedPlayer, key: SortKey): number | string {
  if (key === 'damageTop') return getDamageTop(p)
  if (key === 'clan') return p.clan
  if (key === 'playerCls') return getClassName(p.playerCls ?? -1)
  return Number(p[key as keyof PlayerProperty] ?? 0)
}

/** Объединённая таблица игроков обоих кланов */
function PlayersTable({
  voidBornPlayers,
  improvePlayers,
}: {
  voidBornPlayers: PlayerProperty[]
  improvePlayers: PlayerProperty[]
}) {
  const voidBornSet = useMemo(() => new Set(VOIDBORN_IDS), [])
  const [sortKey, setSortKey] = useState<SortKey>('attackDegree')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [clanFilter, setClanFilter] = useState<'all' | 'VoidBorn' | 'Improve'>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [idFilter, setIdFilter] = useState('')
  const [rangeFilters, setRangeFilters] = useState<Record<string, { min: string; max: string }>>({})

  const allPlayers = useMemo(() => {
    const tagged: TaggedPlayer[] = [
      ...voidBornPlayers.map((p) => ({ ...p, clan: 'VoidBorn' as const })),
      ...improvePlayers.map((p) => ({ ...p, clan: 'Improve' as const })),
    ]

    let filtered = clanFilter === 'all' ? tagged : tagged.filter((p) => p.clan === clanFilter)

    if (classFilter !== 'all') {
      const clsNum = Number(classFilter)
      filtered = filtered.filter((p) => p.playerCls === clsNum)
    }

    if (idFilter) {
      filtered = filtered.filter((p) => String(p.playerId).includes(idFilter))
    }

    for (const [key, range] of Object.entries(rangeFilters)) {
      const minVal = range.min !== '' ? Number(range.min) : null
      const maxVal = range.max !== '' ? Number(range.max) : null
      if (minVal !== null || maxVal !== null) {
        filtered = filtered.filter((p) => {
          const v = key === 'damageTop' ? getDamageTop(p) : Number(p[key as keyof PlayerProperty] ?? 0)
          if (minVal !== null && v < minVal) return false
          if (maxVal !== null && v > maxVal) return false
          return true
        })
      }
    }

    return filtered.sort((a, b) => {
      const va = getSortValue(a, sortKey)
      const vb = getSortValue(b, sortKey)
      const cmp = typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb)
        : (va as number) - (vb as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [voidBornPlayers, improvePlayers, sortKey, sortDir, clanFilter, classFilter, idFilter, rangeFilters])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const filteredVoidBorn = useMemo(() => allPlayers.filter((p) => p.clan === 'VoidBorn'), [allPlayers])
  const filteredImprove = useMemo(() => allPlayers.filter((p) => p.clan === 'Improve'), [allPlayers])

  /** Данные для инфографики распределения: разбиваем отсортированный список на сегменты */
  const distributionData = useMemo(() => {
    const total = allPlayers.length
    if (total === 0) return []
    const segmentCount = Math.min(10, total)
    const segmentSize = Math.ceil(total / segmentCount)
    const segments: { label: string; voidBorn: number; improve: number; total: number }[] = []
    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentSize
      const end = Math.min(start + segmentSize, total)
      const slice = allPlayers.slice(start, end)
      const voidBornCount = slice.filter((p) => p.clan === 'VoidBorn').length
      const improveCount = slice.filter((p) => p.clan === 'Improve').length
      const pctStart = Math.round((start / total) * 100)
      const pctEnd = Math.round((end / total) * 100)
      segments.push({
        label: `${pctStart}–${pctEnd}%`,
        voidBorn: voidBornCount,
        improve: improveCount,
        total: slice.length,
      })
    }
    return segments
  }, [allPlayers])

  if (voidBornPlayers.length === 0 && improvePlayers.length === 0) {
    return <p className={styles.empty}>Нет данных</p>
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: 'playerId', label: 'ID' },
    { key: 'playerCls', label: 'Класс' },
    { key: 'clan', label: 'Клан' },
    { key: 'hp', label: STAT_LABELS.hp },
    { key: 'damageTop', label: 'Верхняя планка' },
    { key: 'attackDegree', label: STAT_LABELS.attackDegree },
    { key: 'defendDegree', label: STAT_LABELS.defendDegree },
    { key: 'vigour', label: STAT_LABELS.vigour },
    { key: 'peakGrade', label: STAT_LABELS.peakGrade },
    { key: 'critRate', label: STAT_LABELS.critRate }
  ]

  const updateRange = (key: string, field: 'min' | 'max', value: string) => {
    setRangeFilters((prev) => ({
      ...prev,
      [key]: { ...prev[key], min: prev[key]?.min ?? '', max: prev[key]?.max ?? '', [field]: value },
    }))
  }

  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpenFilter(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasFilter = (key: SortKey): boolean => {
    if (key === 'playerId') return idFilter !== ''
    if (key === 'clan') return clanFilter !== 'all'
    if (key === 'playerCls') return classFilter !== 'all'
    const r = rangeFilters[key]
    return !!(r && (r.min !== '' || r.max !== ''))
  }

  const getFilterText = (key: SortKey): string | null => {
    if (key === 'playerId' && idFilter) return `«${idFilter}»`
    if (key === 'clan' && clanFilter !== 'all') return clanFilter
    if (key === 'playerCls' && classFilter !== 'all') return getClassName(Number(classFilter))
    const r = rangeFilters[key]
    if (!r) return null
    if (r.min !== '' && r.max !== '') return `${r.min}–${r.max}`
    if (r.min !== '') return `≥${r.min}`
    if (r.max !== '') return `≤${r.max}`
    return null
  }

  const renderFilterPopup = (col: { key: SortKey; label: string }) => {
    if (col.key === 'playerId') {
      return (
        <input
          className={styles.filterInput}
          type="text"
          placeholder="ID..."
          value={idFilter}
          onChange={(e) => setIdFilter(e.target.value)}
          autoFocus
        />
      )
    }
    if (col.key === 'clan') {
      return (
        <select
          className={styles.filterSelect}
          value={clanFilter}
          onChange={(e) => setClanFilter(e.target.value as 'all' | 'VoidBorn' | 'Improve')}
          autoFocus
        >
          <option value="all">Все</option>
          <option value="VoidBorn">VoidBorn</option>
          <option value="Improve">Improve</option>
        </select>
      )
    }
    if (col.key === 'playerCls') {
      return (
        <select
          className={styles.filterSelect}
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          autoFocus
        >
          <option value="all">Все</option>
          {Array.from({ length: 17 }, (_, i) => (
            <option key={i} value={String(i)}>{getClassName(i)}</option>
          ))}
        </select>
      )
    }
    return (
      <div className={styles.rangeFilter}>
        <input
          className={styles.filterInput}
          type="number"
          placeholder="от"
          value={rangeFilters[col.key]?.min ?? ''}
          onChange={(e) => updateRange(col.key, 'min', e.target.value)}
          autoFocus
        />
        <input
          className={styles.filterInput}
          type="number"
          placeholder="до"
          value={rangeFilters[col.key]?.max ?? ''}
          onChange={(e) => updateRange(col.key, 'max', e.target.value)}
        />
      </div>
    )
  }

  return (
    <>
      {/* Суммарные характеристики (с учётом фильтров) */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Суммарные характеристики</h2>
        <div className={styles.compareGrid}>
          {COMPARE_KEYS.map((key) => {
            const voidBornSum = calcSum(filteredVoidBorn, key)
            const improveSum = calcSum(filteredImprove, key)
            const total = voidBornSum + improveSum
            const voidBornPct = total > 0 ? (voidBornSum / total) * 100 : 50
            const improvePct = total > 0 ? (improveSum / total) * 100 : 50
            return (
              <div key={key} className={styles.compareCard}>
                <div className={styles.compareLabel}>{STAT_LABELS[key]}</div>
                <div className={styles.compareBar}>
                  <div className={styles.barContainer}>
                    <div className={styles.barLeft} style={{ width: `${voidBornPct}%` }}>
                      {fmt(voidBornSum)}
                    </div>
                    <div className={styles.barRight} style={{ width: `${improvePct}%` }}>
                      {fmt(improveSum)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Инфографика распределения */}
      {distributionData.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Распределение по силе
            <span className={styles.distributionHint}>
              (сортировка: {columns.find((c) => c.key === sortKey)?.label}{sortDir === 'desc' ? ' ↓' : ' ↑'})
            </span>
          </h2>
          <div className={styles.distributionScale}>
            <span className={styles.distributionEdge}>💪 Сильные</span>
            <span className={styles.distributionEdge}>Слабые 👎</span>
          </div>
          <div className={styles.distributionChart}>
            {distributionData.map((seg, i) => {
              const voidBornPct = seg.total > 0 ? (seg.voidBorn / seg.total) * 100 : 50
              const improvePct = seg.total > 0 ? (seg.improve / seg.total) * 100 : 50
              return (
                <div key={i} className={styles.distributionSegment} title={`${seg.label}: VoidBorn ${seg.voidBorn}, Improve ${seg.improve}`}>
                  <div className={styles.segmentBar}>
                    {seg.voidBorn > 0 && (
                      <div className={styles.segmentVoidBorn} style={{ height: `${voidBornPct}%` }}>
                        {seg.voidBorn}
                      </div>
                    )}
                    {seg.improve > 0 && (
                      <div className={styles.segmentImprove} style={{ height: `${improvePct}%` }}>
                        {seg.improve}
                      </div>
                    )}
                  </div>
                  <div className={styles.segmentLabel}>{seg.label}</div>
                </div>
              )
            })}
          </div>
          <div className={styles.distributionLegend}>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendVoidBorn}`} /> VoidBorn</span>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendImprove}`} /> Improve</span>
          </div>
        </div>
      )}

      {/* Таблица игроков */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Все игроки</h2>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            {columns.map((col) => (
              <th key={col.key} className={styles.sortable}>
                {hasFilter(col.key) && (
                  <div className={styles.filterBadge}>{getFilterText(col.key)}</div>
                )}
                <span onClick={() => handleSort(col.key)}>
                  {col.label}{sortIcon(col.key)}
                </span>
                <span
                  className={`${styles.filterIcon} ${hasFilter(col.key) ? styles.filterActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenFilter(openFilter === col.key ? null : col.key)
                  }}
                  title="Фильтр"
                >
                  🔍
                </span>
                {openFilter === col.key && (
                  <div className={styles.filterPopup} ref={filterRef} onClick={(e) => e.stopPropagation()}>
                    {renderFilterPopup(col)}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allPlayers.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Нет игроков, соответствующих фильтрам
              </td>
            </tr>
          )}
          {allPlayers.map((p, i) => (
            <tr key={p.playerId}>
              <td>{i + 1}</td>
              <td>
                <Link to={`/players/${p.server}/${p.playerId}`} className={styles.playerLink}>
                  {p.playerCls != null && (
                    <img src={getClassIcon(p.playerCls)} alt={getClassName(p.playerCls)} className={styles.classIcon} />
                  )}
                  {formatPlayerName(p.playerId, p.playerName)}
                </Link>
              </td>
              <td>
                {p.playerCls != null ? getClassName(p.playerCls) : '—'}
              </td>
              <td>
                <span className={voidBornSet.has(p.playerId) ? styles.voidBorn : styles.improve}>
                  {p.clan}
                </span>
              </td>
              <td>{p.hp.toLocaleString('ru-RU')}</td>
              <td>
                {p.damageHigh > p.damageMagicHigh ? p.damageLow.toLocaleString('ru-RU') : p.damageMagicLow.toLocaleString('ru-RU')}
                -
                {p.damageHigh > p.damageMagicHigh ? p.damageHigh.toLocaleString('ru-RU') : p.damageMagicHigh.toLocaleString('ru-RU')}
              </td>
              <td>{p.attackDegree.toLocaleString('ru-RU')}</td>
              <td>{p.defendDegree.toLocaleString('ru-RU')}</td>
              <td>{p.vigour.toLocaleString('ru-RU')}</td>
              <td>{p.peakGrade}</td>
              <td>{p.critRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
