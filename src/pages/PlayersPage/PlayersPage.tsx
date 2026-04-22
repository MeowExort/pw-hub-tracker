import { useState, useRef, useEffect } from 'react'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getPlayers, getPlayerPropertiesMax } from '@/shared/api/players'
import type { GetPlayersParams } from '@/shared/api/players'
import type { PlayerListItem, PlayerMaxProperties } from '@/shared/types/api'
import { HexRadar } from '@/shared/ui/HexRadar'
import type { HexRadarAxis } from '@/shared/ui/HexRadar'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { getClassName, getClassIcon, formatDateTime } from '@/shared/utils/format'
import { PlayerTooltip } from '@/shared/ui/PlayerTooltip'
import { TeamTooltip } from '@/shared/ui/TeamTooltip'
import { BuffIndicator } from '@/shared/ui/BuffIndicator'
import { notifyTextInput } from '@/shared/security/behavior-tracker'
import { ClearableInput } from '@/shared/ui/ClearableInput'
import { NumberInput } from '@/shared/ui/NumberInput/NumberInput'
import styles from './PlayersPage.module.scss'

const PAGE_SIZE = 20
const VIEW_STORAGE_KEY = 'players_viewMode'

type ViewMode = 'cards' | 'table'

type SortBy = GetPlayersParams['sortBy']
type StatColumn = NonNullable<SortBy>

const CLASS_OPTIONS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
]

const SERVER_OPTIONS: { value: string; label: string }[] = [
  { value: 'centaur', label: 'Центавр' },
  { value: 'alkor', label: 'Фенрир' },
  { value: 'mizar', label: 'Мицар' },
  { value: 'capella', label: 'Капелла' },
]


/** Средний урон */
function formatDamageRange(low: number, high: number): string {
  return `${low.toLocaleString()}-${high.toLocaleString()}`
}

/** Страница списка игроков */
export function PlayersPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const deferredSearch = useDebouncedValue(searchInput.trim())
  const [server, setServer] = useState<string>('')
  const [cls, setCls] = useState<number | undefined>()
  const [sortBy, setSortBy] = useState<SortBy>('attackDegree')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const filterRef = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpenFilter(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Stat filters
  const [hpMin, setHpMin] = useState('')
  const [hpMax, setHpMax] = useState('')
  const [damageLowMin, setDamageLowMin] = useState('')
  const [damageHighMax, setDamageHighMax] = useState('')
  const [damageMagicLowMin, setDamageMagicLowMin] = useState('')
  const [damageMagicHighMax, setDamageMagicHighMax] = useState('')
  const [attackDegreeMin, setAttackDegreeMin] = useState('')
  const [attackDegreeMax, setAttackDegreeMax] = useState('')
  const [defendDegreeMin, setDefendDegreeMin] = useState('')
  const [defendDegreeMax, setDefendDegreeMax] = useState('')
  const [vigourMin, setVigourMin] = useState('')
  const [vigourMax, setVigourMax] = useState('')
  const [peakGradeMin, setPeakGradeMin] = useState('')
  const [peakGradeMax, setPeakGradeMax] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'cards' || stored === 'table' ? stored : 'table'
  })

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
  }

  const numOrUndef = (v: string): number | undefined => {
    const n = Number(v)
    return v !== '' && !isNaN(n) ? n : undefined
  }

  const params: GetPlayersParams = {
    page,
    pageSize: PAGE_SIZE,
    search: deferredSearch || undefined,
    server: server || undefined,
    cls,
    sortBy,
    sortOrder,
    hpMin: numOrUndef(hpMin),
    hpMax: numOrUndef(hpMax),
    damageLowMin: numOrUndef(damageLowMin),
    damageHighMax: numOrUndef(damageHighMax),
    damageMagicLowMin: numOrUndef(damageMagicLowMin),
    damageMagicHighMax: numOrUndef(damageMagicHighMax),
    attackDegreeMin: numOrUndef(attackDegreeMin),
    attackDegreeMax: numOrUndef(attackDegreeMax),
    defendDegreeMin: numOrUndef(defendDegreeMin),
    defendDegreeMax: numOrUndef(defendDegreeMax),
    vigourMin: numOrUndef(vigourMin),
    vigourMax: numOrUndef(vigourMax),
    peakGradeMin: numOrUndef(peakGradeMin),
    peakGradeMax: numOrUndef(peakGradeMax),
  }

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['players', params],
    queryFn: () => getPlayers(params),
    placeholderData: (previousData) => previousData ? structuredClone(previousData) : undefined,
    structuralSharing: false,
  })

  const { data: maxProps } = useQuery({
    queryKey: ['players-properties-max'],
    queryFn: getPlayerPropertiesMax,
    staleTime: 5 * 60_000,
  })

  const resetFilters = () => {
    setHpMin(''); setHpMax('')
    setDamageLowMin(''); setDamageHighMax('')
    setDamageMagicLowMin(''); setDamageMagicHighMax('')
    setAttackDegreeMin(''); setAttackDegreeMax('')
    setDefendDegreeMin(''); setDefendDegreeMax('')
    setVigourMin(''); setVigourMax('')
    setPeakGradeMin(''); setPeakGradeMax('')
    setPage(1)
  }

  const handleSortColumn = (col: StatColumn) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(col)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const filterState: Record<string, { min: string; max: string; setMin: (v: string) => void; setMax: (v: string) => void }> = {
    hp: { min: hpMin, max: hpMax, setMin: setHpMin, setMax: setHpMax },
    damage: { min: damageLowMin, max: damageHighMax, setMin: setDamageLowMin, setMax: setDamageHighMax },
    damageMagic: { min: damageMagicLowMin, max: damageMagicHighMax, setMin: setDamageMagicLowMin, setMax: setDamageMagicHighMax },
    attackDegree: { min: attackDegreeMin, max: attackDegreeMax, setMin: setAttackDegreeMin, setMax: setAttackDegreeMax },
    defendDegree: { min: defendDegreeMin, max: defendDegreeMax, setMin: setDefendDegreeMin, setMax: setDefendDegreeMax },
    vigour: { min: vigourMin, max: vigourMax, setMin: setVigourMin, setMax: setVigourMax },
    peakGrade: { min: peakGradeMin, max: peakGradeMax, setMin: setPeakGradeMin, setMax: setPeakGradeMax },
  }

  const hasColumnFilter = (col: string): boolean => {
    const f = filterState[col]
    return !!(f && (f.min !== '' || f.max !== ''))
  }

  const getColumnFilterText = (col: string): string | null => {
    const f = filterState[col]
    if (!f) return null
    if (f.min !== '' && f.max !== '') return `${f.min}–${f.max}`
    if (f.min !== '') return `≥${f.min}`
    if (f.max !== '') return `≤${f.max}`
    return null
  }

  const renderColumnFilterPopup = (col: string) => {
    const f = filterState[col]
    if (!f) return null
    return (
      <div className={styles.rangeFilter}>
        <NumberInput
          className={styles.filterInput}
          placeholder="от"
          value={f.min}
          onChange={(e) => { f.setMin(e.target.value); setPage(1) }}
          autoFocus
        />
        <NumberInput
          className={styles.filterInput}
          placeholder="до"
          value={f.max}
          onChange={(e) => { f.setMax(e.target.value); setPage(1) }}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Игроки</h1>
        <div className={styles.filters}>
          <ClearableInput
            className={styles.searchInput}
            type="text"
            placeholder="Поиск по нику…"
            value={searchInput}
            onChange={(e) => { notifyTextInput(searchInput.length, e.target.value.length); setSearchInput(e.target.value); setPage(1) }}
            onClear={() => { notifyTextInput(searchInput.length, 0); setSearchInput(''); setPage(1) }}
          />
          <select
            className={styles.select}
            value={server}
            onChange={(e) => { setServer(e.target.value); setPage(1) }}
          >
            <option value="">Все сервера</option>
            {SERVER_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            className={styles.select}
            value={cls ?? ''}
            onChange={(e) => { setCls(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
          >
            <option value="">Все классы</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>{getClassName(c)}</option>
            ))}
          </select>
          <button className={styles.resetBtn} onClick={resetFilters}>Сбросить фильтры</button>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'cards' ? styles.active : ''}`}
              onClick={() => handleViewChange('cards')}
              title="Карточки"
            >
              ▦
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
              onClick={() => handleViewChange('table')}
              title="Таблица"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {isLoading && !data && (
        <div className={styles.center}><Spinner /></div>
      )}

      {error && !data && (
        <ErrorMessage message="Не удалось загрузить игроков" onRetry={() => refetch()} />
      )}

      {data && viewMode === 'table' && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Игрок</th>
                  <th>Сервер</th>
                  <th>Команда</th>
                  <ColumnHeader col="hp" label="HP" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn} openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef} hasFilter={hasColumnFilter} getFilterText={getColumnFilterText} renderPopup={renderColumnFilterPopup} />
                  <ColumnHeader col="damage" label="Физ. урон" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn} openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef} hasFilter={hasColumnFilter} getFilterText={getColumnFilterText} renderPopup={renderColumnFilterPopup} />
                  <ColumnHeader col="damageMagic" label="Маг. урон" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn} openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef} hasFilter={hasColumnFilter} getFilterText={getColumnFilterText} renderPopup={renderColumnFilterPopup} />
                  <ColumnHeader col="attackDegree" label="ПА" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn} openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef} hasFilter={hasColumnFilter} getFilterText={getColumnFilterText} renderPopup={renderColumnFilterPopup} />
                  <ColumnHeader col="defendDegree" label="ПЗ" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn} openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef} hasFilter={hasColumnFilter} getFilterText={getColumnFilterText} renderPopup={renderColumnFilterPopup} />
                  <ColumnHeader col="vigour" label="БД" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn} openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef} hasFilter={hasColumnFilter} getFilterText={getColumnFilterText} renderPopup={renderColumnFilterPopup} />
                  <ColumnHeader col="peakGrade" label="БУ" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn} openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef} hasFilter={hasColumnFilter} getFilterText={getColumnFilterText} renderPopup={renderColumnFilterPopup} />
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr><td colSpan={11} className={styles.empty}>Игроки не найдены</td></tr>
                ) : data.items.map((player, i) => (
                  <PlayerRow key={`${player.server}-${player.id}-${i}`} player={player} rank={(page - 1) * PAGE_SIZE + i + 1} />
                ))}
              </tbody>
            </table>
          </div>
          {isFetching && <div className={styles.center}><Spinner /></div>}
          {data.items.length > 0 && <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />}
        </>
      )}

      {data && viewMode === 'cards' && (
        <>
          {data.items.length === 0 ? (
            <div className={styles.empty}>Игроки не найдены</div>
          ) : (
            <div className={styles.cardsList}>
              {data.items.map((player, i) => (
                <PlayerCard key={`${player.server}-${player.id}-${i}`} player={player} rank={(page - 1) * PAGE_SIZE + i + 1} maxProps={maxProps ?? null} />
              ))}
            </div>
          )}
          {isFetching && <div className={styles.center}><Spinner /></div>}
          {data.items.length > 0 && <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}

/** Строка таблицы игрока */
function PlayerRow({ player, rank }: { player: PlayerListItem; rank: number }) {
  console.log('Rendering player row:', player)
  const p = player.properties
  const serverSlug = player.server ?? 'unknown'
  return (
    <tr>
      <td className={styles.rankCell}>{rank}</td>
      <td>
        <PlayerTooltip playerId={player.id} server={serverSlug} cls={player.cls} name={player.name}>
          <Link to={`/players/${serverSlug}/${player.id}`} className={styles.playerLink}>
            <img src={getClassIcon(player.cls)} alt={getClassName(player.cls)} className={styles.classIcon} title={getClassName(player.cls)} />
            <span className={styles.playerName}>{player.name ?? `#${player.id}`}</span>
          </Link>
        </PlayerTooltip>
      </td>
      <td>{serverSlug}</td>
      <td>
        {player.teamId ? (
          <TeamTooltip teamId={player.teamId} teamName={player.teamName}>
            <Link to={`/teams/${player.teamId}`} className={styles.teamLink}>
              {player.teamName ?? `#${player.teamId}`}
            </Link>
          </TeamTooltip>
        ) : '—'}
      </td>
      {p ? (
        <>
          <td className={styles.numCell}><BuffIndicator buffs={p.hpBuffs}>{p.hp.toLocaleString()}</BuffIndicator></td>
          <td className={styles.numCell}><BuffIndicator buffs={[...(p.damageLowBuffs ?? []), ...(p.damageHighBuffs ?? [])].filter((b, i, a) => a.findIndex(x => x.id === b.id) === i)}>{formatDamageRange(p.damageLow, p.damageHigh)}</BuffIndicator></td>
          <td className={styles.numCell}><BuffIndicator buffs={[...(p.damageMagicLowBuffs ?? []), ...(p.damageMagicHighBuffs ?? [])].filter((b, i, a) => a.findIndex(x => x.id === b.id) === i)}>{formatDamageRange(p.damageMagicLow, p.damageMagicHigh)}</BuffIndicator></td>
          <td className={styles.numCell}><BuffIndicator buffs={p.attackDegreeBuffs}>{p.attackDegree}</BuffIndicator></td>
          <td className={styles.numCell}><BuffIndicator buffs={p.defendDegreeBuffs}>{p.defendDegree}</BuffIndicator></td>
          <td className={styles.numCell}><BuffIndicator buffs={p.vigourBuffs}>{p.vigour}</BuffIndicator></td>
          <td className={styles.numCell}><BuffIndicator buffs={p.peakGradeBuffs}>{p.peakGrade}</BuffIndicator></td>
        </>
      ) : (
        <td colSpan={6} className={styles.noData}>Нет данных</td>
      )}
    </tr>
  )
}

/** Построить оси для radar chart */
function buildRadarAxes(p: NonNullable<PlayerListItem['properties']>, maxProps: PlayerMaxProperties): HexRadarAxis[] {
  const physDmg = (p.damageLow + p.damageHigh) / 2
  const magDmg = (p.damageMagicLow + p.damageMagicHigh) / 2
  const usePhys = physDmg >= magDmg
  const dmgValue = usePhys ? physDmg : magDmg
  const dmgMax = usePhys
    ? (maxProps.damageLow + maxProps.damageHigh) / 2
    : (maxProps.damageMagicLow + maxProps.damageMagicHigh) / 2

  return [
    { label: 'HP', value: p.hp, max: maxProps.hp },
    { label: usePhys ? 'Физ' : 'Маг', value: dmgValue, max: dmgMax || 1 },
    { label: 'ПА', value: p.attackDegree, max: maxProps.attackDegree || 1 },
    { label: 'ПЗ', value: p.defendDegree, max: maxProps.defendDegree || 1 },
    { label: 'БД', value: p.vigour, max: maxProps.vigour || 1 },
    { label: 'Защ', value: p.defense, max: maxProps.defense || 1 },
  ]
}

/** Карточка игрока */
function PlayerCard({ player, rank, maxProps }: { player: PlayerListItem; rank: number; maxProps: PlayerMaxProperties | null }) {
  const p = player.properties
  const serverSlug = player.server ?? 'unknown'
  return (
    <Link to={`/players/${serverSlug}/${player.id}`} className={styles.playerCard}>
      <div className={styles.cardTop}>
        <span className={styles.cardRank}>#{rank}</span>
        <img src={getClassIcon(player.cls)} alt={getClassName(player.cls)} className={styles.cardClassIcon} />
        <div className={styles.cardInfo}>
          <span className={styles.cardName}>{player.name ?? `#${player.id}`}</span>
          <span className={styles.cardMeta}>
            {getClassName(player.cls)} · {serverSlug}
            {player.teamName && ` · ${player.teamName}`}
          </span>
        </div>
      </div>
      {p ? (
        <div className={styles.cardStats}>
          {maxProps ? (
            <HexRadar axes={buildRadarAxes(p, maxProps)} size={160} />
          ) : (
            <>
              <StatBadge label="HP" value={p.hp.toLocaleString()} buffs={p.hpBuffs} />
              <StatBadge label="Физ." value={formatDamageRange(p.damageLow, p.damageHigh)} buffs={[...(p.damageLowBuffs ?? []), ...(p.damageHighBuffs ?? [])].filter((b, i, a) => a.findIndex(x => x.id === b.id) === i)} />
              <StatBadge label="Маг." value={formatDamageRange(p.damageMagicLow, p.damageMagicHigh)} buffs={[...(p.damageMagicLowBuffs ?? []), ...(p.damageMagicHighBuffs ?? [])].filter((b, i, a) => a.findIndex(x => x.id === b.id) === i)} />
              <StatBadge label="ПА" value={String(p.attackDegree)} buffs={p.attackDegreeBuffs} />
              <StatBadge label="ПЗ" value={String(p.defendDegree)} buffs={p.defendDegreeBuffs} />
              <StatBadge label="БД" value={String(p.vigour)} buffs={p.vigourBuffs} />
            </>
          )}
          <div className={styles.cardDate}>Обновлено: {formatDateTime(p.updatedAt)}</div>
        </div>
      ) : (
        <div className={styles.noData}>Нет данных о характеристиках</div>
      )}
    </Link>
  )
}

/** Бейдж характеристики в карточке */
function StatBadge({ label, value, buffs }: { label: string; value: string; buffs?: import('@/shared/types/api').BuffDto[] }) {
  return (
    <div className={styles.statBadge}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}><BuffIndicator buffs={buffs}>{value}</BuffIndicator></span>
    </div>
  )
}

/** Заголовок колонки с сортировкой и фильтром */
function ColumnHeader({ col, label, sortBy, sortOrder, onSort, openFilter, setOpenFilter, filterRef, hasFilter, getFilterText, renderPopup }: {
  col: StatColumn
  label: string
  sortBy: SortBy
  sortOrder: 'asc' | 'desc'
  onSort: (col: StatColumn) => void
  openFilter: string | null
  setOpenFilter: (v: string | null) => void
  filterRef: React.RefObject<HTMLDivElement>
  hasFilter: (col: string) => boolean
  getFilterText: (col: string) => string | null
  renderPopup: (col: string) => React.ReactNode
}) {
  const active = hasFilter(col)
  const filterText = getFilterText(col)
  return (
    <th className={styles.sortable}>
      {active && filterText && (
        <div className={styles.filterBadge}>{filterText}</div>
      )}
      <span onClick={() => onSort(col)}>
        {label}{sortBy === col ? (sortOrder === 'desc' ? ' ▼' : ' ▲') : ''}
      </span>
      <span
        className={`${styles.filterIcon} ${active ? styles.filterActive : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpenFilter(openFilter === col ? null : col)
        }}
        title="Фильтр"
      >
        🔍
      </span>
      {openFilter === col && (
        <div className={styles.filterPopup} ref={filterRef} onClick={(e) => e.stopPropagation()}>
          {renderPopup(col)}
        </div>
      )}
    </th>
  )
}
