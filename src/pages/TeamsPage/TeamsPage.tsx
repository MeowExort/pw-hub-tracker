import { useState, useEffect } from 'react'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getTeams, searchTeams } from '@/shared/api/teams'
import type { BattleStat, TeamListItem, TeamListMember } from '@/shared/types/api'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import { formatDateTime, getServerName, getClassIcon, getClassName } from '@/shared/utils/format'
import { PlayerTooltip } from '@/shared/ui/PlayerTooltip'
import { notifyTextInput } from '@/shared/security/behavior-tracker'
import styles from './TeamsPage.module.scss'

const PAGE_SIZE = 20
const SORT_STORAGE_KEY = 'teams_sortBy'
const VIEW_STORAGE_KEY = 'teams_viewMode'

type SortBy = '' | 'ratingOrder' | 'ratingChaos'
type ViewMode = 'cards' | 'table'

function isValidSort(v: string | null): v is SortBy {
  return v === '' || v === 'ratingOrder' || v === 'ratingChaos'
}

/** Медаль для топ-3 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className={styles.medal}>🥇</span>
  if (rank === 2) return <span className={styles.medal}>🥈</span>
  if (rank === 3) return <span className={styles.medal}>🥉</span>
  return <span className={styles.rankNum}>#{rank}</span>
}

/** Получить BattleStat по matchPattern (0=Порядок, 1=Хаос) */
function getStat(team: TeamListItem, pattern: number): BattleStat | undefined {
  return team.battleStats?.find((s) => s.matchPattern === pattern)
}

/** Вычислить WR число */
function calcWrPercent(wins: number, total: number): number {
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

/** Цвет WR бара */
function wrColor(wr: number): string {
  if (wr >= 60) return 'var(--success, #27ae60)'
  if (wr >= 50) return 'var(--warning, #f39c12)'
  return 'var(--danger, #e74c3c)'
}

/** Прогресс-бар WR */
function WinRateBar({ wins, total }: { wins: number; total: number }) {
  const wr = calcWrPercent(wins, total)
  return (
    <div className={styles.wrBar}>
      <div className={styles.wrBarTrack}>
        <div
          className={styles.wrBarFill}
          style={{ width: `${wr}%`, background: wrColor(wr) }}
        />
      </div>
      <span className={styles.wrBarLabel}>{wr}%</span>
    </div>
  )
}

/** Блок рейтинга для карточки (Вариант A) */
function CardRatingBlock({ icon, label, stat, memberCount }: { icon: string; label: string; stat?: BattleStat; memberCount: number }) {
  if (!stat) {
    return (
      <div className={styles.cardRatingBlock}>
        <div className={styles.cardRatingHead}>
          <span className={styles.cardRatingIcon}>{icon}</span>
          <span className={styles.cardRatingLabel}>{label}</span>
          <span className={styles.cardRatingValue}>—</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.cardRatingBlock}>
      <div className={styles.cardRatingHead}>
        <span className={styles.cardRatingIcon}>{icon}</span>
        <span className={styles.cardRatingLabel}>{label}</span>
        <span className={styles.cardRatingValue}>{memberCount > 0 ? Math.trunc(stat.score / memberCount) : stat.score}</span>
        {stat.rank > 0 && <span className={styles.cardRatingRank}>#{stat.rank}</span>}
      </div>
      <div className={styles.cardRatingDetails}>
        <WinRateBar wins={stat.winCount} total={stat.battleCount} />
        <span className={styles.cardRatingBattles}>{stat.battleCount} боёв</span>
      </div>
      {(stat.weekBattleCount > 0) && (
        <div className={styles.cardRatingWeek}>
          Неделя: +{stat.weekWinCount}W / {stat.weekBattleCount} боёв
        </div>
      )}
    </div>
  )
}

/** Конвертация zoneId в имя сервера для URL */
function zoneToServer(zoneId: string): string {
  switch (zoneId) {
    case '2': return 'centaur'
    case '3': return 'alkor'
    case '5': return 'mizar'
    case '29': return 'capella'
    default: return 'unknown'
  }
}

/** Ряд иконок участников для карточки (Вариант A) */
function MembersRow({ members, captainId, server }: { members: TeamListMember[]; captainId: number; server: string }) {
  const realServer = zoneToServer(server)
  return (
    <div className={styles.membersRow}>
      <div className={styles.membersIcons}>
        {members.map((m) => (
          <PlayerTooltip
            key={m.playerId}
            playerId={m.playerId}
            server={realServer}
            cls={m.cls}
            name={m.name}
            isCaptain={m.playerId === captainId}
          >
            <Link to={`/players/${realServer}/${m.playerId}`}>
              <img
                src={getClassIcon(m.cls)}
                alt={getClassName(m.cls)}
                className={`${styles.memberIcon} ${m.playerId === captainId ? styles.memberIconCaptain : ''}`}
              />
            </Link>
          </PlayerTooltip>
        ))}
      </div>
    </div>
  )
}

/** Компактные иконки участников для таблицы (Вариант B) */
function MembersIcons({ members, captainId, server }: { members: TeamListMember[]; captainId: number; server: string }) {
  const realServer = zoneToServer(server)
  return (
    <div className={styles.membersIconsCompact}>
      {members.map((m) => (
        <PlayerTooltip
          key={m.playerId}
          playerId={m.playerId}
          server={realServer}
          cls={m.cls}
          name={m.name}
          isCaptain={m.playerId === captainId}
        >
          <Link to={`/players/${realServer}/${m.playerId}`}>
            <img
              src={getClassIcon(m.cls)}
              alt={getClassName(m.cls)}
              className={`${styles.memberIconSmall} ${m.playerId === captainId ? styles.memberIconCaptain : ''}`}
            />
          </Link>
        </PlayerTooltip>
      ))}
    </div>
  )
}

/** Страница рейтинга команд */
export function TeamsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [zoneId, setZoneId] = useState<number | undefined>()

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'cards' || stored === 'table' ? stored : 'cards'
  })

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
  }

  // Инициализация sortBy: URL > localStorage > default
  const urlSort = searchParams.get('sortBy')
  const initialSort = (): SortBy => {
    if (isValidSort(urlSort)) return urlSort
    const stored = localStorage.getItem(SORT_STORAGE_KEY)
    if (stored && isValidSort(stored)) return stored
    return 'ratingChaos'
  }
  const [sortBy, setSortByState] = useState<SortBy>(initialSort)

  // Синхронизация sortBy в URL при первом рендере (если взяли из localStorage)
  useEffect(() => {
    if (!isValidSort(urlSort) || urlSort !== sortBy) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (sortBy) next.set('sortBy', sortBy)
        else next.delete('sortBy')
        return next
      }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setSortBy = (value: SortBy) => {
    setSortByState(value)
    localStorage.setItem(SORT_STORAGE_KEY, value)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set('sortBy', value)
      else next.delete('sortBy')
      return next
    }, { replace: true })
  }
  const [searchInput, setSearchInput] = useState('')
  const deferredSearch = useDebouncedValue(searchInput.trim())

  const isSearchMode = deferredSearch.length > 0

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: isSearchMode
      ? ['teams-search', { name: deferredSearch, page, zoneId }]
      : ['teams', { page, zoneId, sortBy }],
    queryFn: () =>
      isSearchMode
        ? searchTeams({ name: deferredSearch, page, pageSize: PAGE_SIZE, zoneId, include: 'battlestats,members' })
        : getTeams({
            page,
            pageSize: PAGE_SIZE,
            zoneId,
            sortBy: sortBy || undefined,
            include: 'battlestats,members',
          }),
  })

  /** Вычислить глобальный ранг элемента на текущей странице */
  const getRank = (index: number) => (page - 1) * PAGE_SIZE + index + 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Рейтинг команд</h1>
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Поиск по названию…"
            value={searchInput}
            onChange={(e) => {
              notifyTextInput(searchInput.length, e.target.value.length)
              setSearchInput(e.target.value)
              setPage(1)
            }}
          />
          <select
            className={styles.select}
            value={zoneId ?? ''}
            onChange={(e) => {
              setZoneId(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
          >
            <option value="">Все сервера</option>
            {[2, 3, 5, 29].map((z) => (
              <option key={z} value={z}>{getServerName(z)}</option>
            ))}
          </select>
          {!isSearchMode && (
            <select
              className={styles.select}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortBy)
                setPage(1)
              }}
            >
              <option value="">По обновлению</option>
              <option value="ratingOrder">Рейтинг (Порядок)</option>
              <option value="ratingChaos">Рейтинг (Хаос)</option>
            </select>
          )}
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

      {isLoading && (
        <div className={styles.center}><Spinner /></div>
      )}

      {error && (
        <ErrorMessage message="Не удалось загрузить команды" onRetry={() => refetch()} />
      )}

      {/* ── Вариант A: Карточки ── */}
      {data && viewMode === 'cards' && (
        <>
          <div className={styles.cardsList}>
            {data.items.map((team, i) => {
              const rank = getRank(i)
              const isTop3 = rank <= 3 && !isSearchMode && sortBy !== ''
              const orderStat = getStat(team, 0)
              const chaosStat = getStat(team, 1)
              return (
                <Link
                  key={team.id}
                  to={`/teams/${team.id}`}
                  className={`${styles.teamCard} ${isTop3 ? styles.teamCardTop : ''}`}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.cardRank}>
                      {!isSearchMode && sortBy !== '' && <RankBadge rank={rank} />}
                    </div>
                    <div className={styles.cardInfo}>
                      <span className={styles.cardName}>{team.name}</span>
                      <span className={styles.cardMeta}>
                        {getServerName(team.zoneId)} · 👥 {team.memberCount} участн.
                      </span>
                    </div>
                  </div>
                  {team.members && team.members.length > 0 && (
                    <MembersRow members={team.members} captainId={team.captainId} server={String(team.zoneId)} />
                  )}
                  <div className={styles.cardRatings}>
                    <CardRatingBlock icon="⚔" label="Порядок" stat={orderStat} memberCount={team.memberCount} />
                    <CardRatingBlock icon="💀" label="Хаос" stat={chaosStat} memberCount={team.memberCount} />
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.cardDate}>Обновлено: {formatDateTime(team.updatedAt)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
          <Pagination
            page={page}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {/* ── Вариант B: Улучшенная таблица ── */}
      {data && viewMode === 'table' && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                {!isSearchMode && sortBy !== '' && <th>#</th>}
                <th>Название</th>
                <th>Сервер</th>
                <th>👥</th>
                <th>⚔ Порядок</th>
                <th>WR (Порядок)</th>
                <th>💀 Хаос</th>
                <th>WR (Хаос)</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((team, i) => {
                const rank = getRank(i)
                const isTop3 = rank <= 3 && !isSearchMode && sortBy !== ''
                const orderStat = getStat(team, 0)
                const chaosStat = getStat(team, 1)
                return (
                  <tr key={team.id} className={isTop3 ? styles.topRow : ''}>
                    {!isSearchMode && sortBy !== '' && (
                      <td className={styles.rankCell}>
                        <RankBadge rank={rank} />
                      </td>
                    )}
                    <td>
                      <Link to={`/teams/${team.id}`} className={styles.teamLink}>
                        {team.name}
                      </Link>
                    </td>
                    <td>{getServerName(team.zoneId)}</td>
                    <td>
                      {team.members && team.members.length > 0 ? (
                        <MembersIcons members={team.members} captainId={team.captainId} server={String(team.zoneId)} />
                      ) : (
                        team.memberCount
                      )}
                    </td>
                    <td className={styles.ratingCell}>
                      {orderStat ? (
                        <span>
                          <strong>{team.memberCount > 0 ? Math.trunc(orderStat.score / team.memberCount) : orderStat.score}</strong>
                          {orderStat.rank > 0 && <span className={styles.tableRank}> #{orderStat.rank}</span>}
                          <span className={styles.tableBattles}> · {orderStat.battleCount}</span>
                        </span>
                      ) : (
                        team.ratingOrder != null ? Math.trunc(team.ratingOrder / (team.memberCount || 1)) : '—'
                      )}
                    </td>
                    <td className={styles.wrCell}>
                      {orderStat ? (
                        <WinRateBar wins={orderStat.winCount} total={orderStat.battleCount} />
                      ) : '—'}
                    </td>
                    <td className={styles.ratingCell}>
                      {chaosStat ? (
                        <span>
                          <strong>{team.memberCount > 0 ? Math.trunc(chaosStat.score / team.memberCount) : chaosStat.score}</strong>
                          {chaosStat.rank > 0 && <span className={styles.tableRank}> #{chaosStat.rank}</span>}
                          <span className={styles.tableBattles}> · {chaosStat.battleCount}</span>
                        </span>
                      ) : (
                        team.ratingChaos != null ? Math.trunc(team.ratingChaos / (team.memberCount || 1)) : '—'
                      )}
                    </td>
                    <td className={styles.wrCell}>
                      {chaosStat ? (
                        <WinRateBar wins={chaosStat.winCount} total={chaosStat.battleCount} />
                      ) : '—'}
                    </td>
                    <td className={styles.date}>{formatDateTime(team.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination
            page={page}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
