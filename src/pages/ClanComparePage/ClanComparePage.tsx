import { useMemo, useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getPlayerPropertiesByIds } from '@/shared/api/players'
import type { PlayerDetailProperties } from '@/shared/types/api'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { formatPlayerName, getClassName, getClassIcon } from '@/shared/utils/format'
import { PlayerTooltip } from '@/shared/ui/PlayerTooltip'
import { BuffIndicator } from '@/shared/ui/BuffIndicator'
import { AURA_IDS, ETERNALS_IDS } from './clans'
import styles from './ClanComparePage.module.scss'

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
const COMPARE_KEYS: (keyof PlayerDetailProperties)[] = ['attackDegree', 'defendDegree', 'vigour', 'peakGrade']

/** Вычислить сумму значений характеристики */
function calcSum(players: PlayerDetailProperties[], key: keyof PlayerDetailProperties): number {
  return players.reduce((acc, p) => acc + Number(p[key] ?? 0), 0)
}

/** Форматировать число */
function fmt(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('ru-RU')
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

/** Страница сравнения кланов Aura и Eternals */
export function ClanComparePage() {
  const allPlayers = useMemo(
    () => [...AURA_IDS, ...ETERNALS_IDS].map((id) => ({ Id: id, Server: 'alkor' })),
    [],
  )

  const query = useQuery({
    queryKey: ['clanCompare', 'alkor', 'properties'],
    queryFn: () => getPlayerPropertiesByIds(allPlayers),
  })

  const { auraPlayers, eternalsPlayers } = useMemo(() => {
    if (!query.data) return { auraPlayers: [], eternalsPlayers: [] }
    const auraSet = new Set(AURA_IDS)
    const eternalsSet = new Set(ETERNALS_IDS)
    return {
      auraPlayers: query.data.filter((p) => auraSet.has(p.playerId)),
      eternalsPlayers: query.data.filter((p) => eternalsSet.has(p.playerId)),
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
          <div className={`${styles.clanName} ${styles.aura}`}>Aura</div>
          <div className={styles.clanCount}>
            {auraPlayers.length} игроков
          </div>
        </div>
        <div className={styles.vs}>VS</div>
        <div className={styles.clanCard}>
          <div className={`${styles.clanName} ${styles.eternals}`}>Eternals</div>
          <div className={styles.clanCount}>
            {eternalsPlayers.length} игроков
          </div>
        </div>
      </div>

      {/* Таблица и суммарные характеристики */}
      <PlayersTable auraPlayers={auraPlayers} eternalsPlayers={eternalsPlayers} />
    </div>
  )
}

type TaggedPlayer = PlayerDetailProperties & { clan: 'Aura' | 'Eternals' }

type SortKey = 'playerId' | 'clan' | 'playerCls' | 'hp' | 'damageTop' | 'attackDegree' | 'defendDegree' | 'vigour' | 'peakGrade' | 'critRate'
type SortDir = 'asc' | 'desc'

/** Получить верхнюю планку урона для сортировки */
function getDamageTop(p: PlayerDetailProperties): number {
  return Math.max(p.damageHigh, p.damageMagicHigh)
}

/** Получить значение для сортировки */
function getSortValue(p: TaggedPlayer, key: SortKey): number | string {
  if (key === 'damageTop') return getDamageTop(p)
  if (key === 'clan') return p.clan
  if (key === 'playerCls') return getClassName(p.playerCls ?? -1)
  return Number(p[key as keyof PlayerDetailProperties] ?? 0)
}

/** Объединённая таблица игроков обоих кланов */
function PlayersTable({
  auraPlayers,
  eternalsPlayers,
}: {
  auraPlayers: PlayerDetailProperties[]
  eternalsPlayers: PlayerDetailProperties[]
}) {
  const auraSet = useMemo(() => new Set(AURA_IDS), [])
  const [sortKey, setSortKey] = useState<SortKey>('attackDegree')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [clanFilter, setClanFilter] = useState<'all' | 'Aura' | 'Eternals'>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [idFilter, setIdFilter] = useState('')
  const [rangeFilters, setRangeFilters] = useState<Record<string, { min: string; max: string }>>({})

  const allPlayers = useMemo(() => {
    const tagged: TaggedPlayer[] = [
      ...auraPlayers.map((p) => ({ ...p, clan: 'Aura' as const })),
      ...eternalsPlayers.map((p) => ({ ...p, clan: 'Eternals' as const })),
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
          const v = key === 'damageTop' ? getDamageTop(p) : Number(p[key as keyof PlayerDetailProperties] ?? 0)
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
  }, [auraPlayers, eternalsPlayers, sortKey, sortDir, clanFilter, classFilter, idFilter, rangeFilters])

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

  const filteredAura = useMemo(() => allPlayers.filter((p) => p.clan === 'Aura'), [allPlayers])
  const filteredEternals = useMemo(() => allPlayers.filter((p) => p.clan === 'Eternals'), [allPlayers])

  /** Данные для инфографики распределения: разбиваем отсортированный список на сегменты */
  const distributionData = useMemo(() => {
    const total = allPlayers.length
    if (total === 0) return []
    const segmentCount = Math.min(10, total)
    const segmentSize = Math.ceil(total / segmentCount)
    const segments: { label: string; aura: number; eternals: number; total: number }[] = []
    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentSize
      const end = Math.min(start + segmentSize, total)
      const slice = allPlayers.slice(start, end)
      const auraCount = slice.filter((p) => p.clan === 'Aura').length
      const eternalsCount = slice.filter((p) => p.clan === 'Eternals').length
      const pctStart = Math.round((start / total) * 100)
      const pctEnd = Math.round((end / total) * 100)
      segments.push({
        label: `${pctStart}–${pctEnd}%`,
        aura: auraCount,
        eternals: eternalsCount,
        total: slice.length,
      })
    }
    return segments
  }, [allPlayers])

  if (auraPlayers.length === 0 && eternalsPlayers.length === 0) {
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
          onChange={(e) => setClanFilter(e.target.value as 'all' | 'Aura' | 'Eternals')}
          autoFocus
        >
          <option value="all">Все</option>
          <option value="Aura">Aura</option>
          <option value="Eternals">Eternals</option>
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
            const auraSum = calcSum(filteredAura, key)
            const eternalsSum = calcSum(filteredEternals, key)
            const total = auraSum + eternalsSum
            const auraPct = total > 0 ? (auraSum / total) * 100 : 50
            const eternalsPct = total > 0 ? (eternalsSum / total) * 100 : 50
            return (
              <div key={key} className={styles.compareCard}>
                <div className={styles.compareLabel}>{STAT_LABELS[key]}</div>
                <div className={styles.compareBar}>
                  <div className={styles.barContainer}>
                    <div className={styles.barLeft} style={{ width: `${auraPct}%` }}>
                      {fmt(auraSum)}
                    </div>
                    <div className={styles.barRight} style={{ width: `${eternalsPct}%` }}>
                      {fmt(eternalsSum)}
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
              const auraPct = seg.total > 0 ? (seg.aura / seg.total) * 100 : 50
              const eternalsPct = seg.total > 0 ? (seg.eternals / seg.total) * 100 : 50
              return (
                <div key={i} className={styles.distributionSegment} title={`${seg.label}: Aura ${seg.aura}, Eternals ${seg.eternals}`}>
                  <div className={styles.segmentBar}>
                    {seg.aura > 0 && (
                      <div className={styles.segmentAura} style={{ height: `${auraPct}%` }}>
                        {seg.aura}
                      </div>
                    )}
                    {seg.eternals > 0 && (
                      <div className={styles.segmentEternals} style={{ height: `${eternalsPct}%` }}>
                        {seg.eternals}
                      </div>
                    )}
                  </div>
                  <div className={styles.segmentLabel}>{seg.label}</div>
                </div>
              )
            })}
          </div>
          <div className={styles.distributionLegend}>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendAura}`} /> Aura</span>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendEternals}`} /> Eternals</span>
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
                <PlayerTooltip playerId={p.playerId} server={p.server} cls={p.playerCls} name={p.playerName}>
                  <Link to={`/players/${p.server}/${p.playerId}`} className={styles.playerLink}>
                    {p.playerCls != null && (
                      <img src={getClassIcon(p.playerCls)} alt={getClassName(p.playerCls)} className={styles.classIcon} />
                    )}
                    {formatPlayerName(p.playerId, p.playerName)}
                  </Link>
                </PlayerTooltip>
              </td>
              <td>
                {p.playerCls != null ? getClassName(p.playerCls) : '—'}
              </td>
              <td>
                <span className={auraSet.has(p.playerId) ? styles.aura : styles.eternals}>
                  {p.clan}
                </span>
              </td>
              <td><BuffIndicator buffs={p.hpBuffs}>{p.hp.toLocaleString('ru-RU')}</BuffIndicator></td>
              <td>
                <BuffIndicator buffs={p.damageHigh > p.damageMagicHigh ? p.damageHighBuffs : p.damageMagicHighBuffs}>
                  {p.damageHigh > p.damageMagicHigh ? p.damageLow.toLocaleString('ru-RU') : p.damageMagicLow.toLocaleString('ru-RU')}
                  -
                  {p.damageHigh > p.damageMagicHigh ? p.damageHigh.toLocaleString('ru-RU') : p.damageMagicHigh.toLocaleString('ru-RU')}
                </BuffIndicator>
              </td>
              <td><BuffIndicator buffs={p.attackDegreeBuffs}>{p.attackDegree.toLocaleString('ru-RU')}</BuffIndicator></td>
              <td><BuffIndicator buffs={p.defendDegreeBuffs}>{p.defendDegree.toLocaleString('ru-RU')}</BuffIndicator></td>
              <td><BuffIndicator buffs={p.vigourBuffs}>{p.vigour.toLocaleString('ru-RU')}</BuffIndicator></td>
              <td><BuffIndicator buffs={p.peakGradeBuffs}>{p.peakGrade}</BuffIndicator></td>
              <td><BuffIndicator buffs={p.critRateBuffs}>{p.critRate}</BuffIndicator></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
