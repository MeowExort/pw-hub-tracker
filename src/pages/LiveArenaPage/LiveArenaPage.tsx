import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getLiveTeams } from '@/shared/api/teams'
import type { LiveTeam, LiveTeamMember } from '@/shared/types/api'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Pagination } from '@/shared/ui/Pagination'
import {
  formatDateTime,
  getServerName,
  getClassIcon,
  getClassName,
} from '@/shared/utils/format'
import { PlayerTooltip } from '@/shared/ui/PlayerTooltip'
import styles from './LiveArenaPage.module.scss'

const PAGE_SIZE = 20
const SORT_STORAGE_KEY = 'live_arena_sortBy'
const MINUTES_SINCE = 15

type SortBy = 'rating' | 'lastBattle'

function isValidSort(v: string | null): v is SortBy {
  return v === 'rating' || v === 'lastBattle'
}

/** zoneId → server-name для построения URL `/players/:server/:id`. */
function zoneToServer(zoneId: number): string {
  switch (zoneId) {
    case 2: return 'centaur'
    case 3: return 'alkor'
    case 5: return 'mizar'
    case 29: return 'capella'
    default: return 'unknown'
  }
}

/**
 * Страница «Сейчас аренят» — команды, у которых был хотя бы один матч за
 * последние 15 минут (окно зашито на бэке через `minutesSince`-параметр).
 *
 * Стейт страницы (`sortBy`, `page`) синхронизирован двусторонне между:
 *   • URL-search-params — чтобы ссылку можно было пошарить, и
 *   • localStorage (только sortBy) — чтобы пользовательское предпочтение
 *     переживало перезагрузку.
 *
 * Приоритет при загрузке страницы: URL > localStorage > дефолт `lastBattle`.
 */
export function LiveArenaPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Initial sort: URL > localStorage > default.
  const urlSort = searchParams.get('sortBy')
  const initialSort = (): SortBy => {
    if (isValidSort(urlSort)) return urlSort
    const stored = localStorage.getItem(SORT_STORAGE_KEY)
    if (stored && isValidSort(stored)) return stored
    return 'lastBattle'
  }
  const [sortBy, setSortByState] = useState<SortBy>(initialSort)

  // Initial page from URL.
  const urlPage = searchParams.get('page')
  const [page, setPageState] = useState<number>(() => {
    const p = urlPage ? parseInt(urlPage, 10) : 1
    return Number.isFinite(p) && p > 0 ? p : 1
  })

  // На первом рендере пишем sortBy в URL, если он пришёл из localStorage
  // (чтобы шарингом подхватывалась актуальная сортировка).
  useEffect(() => {
    if (urlSort !== sortBy) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('sortBy', sortBy)
        return next
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSortBy = (value: SortBy) => {
    setSortByState(value)
    localStorage.setItem(SORT_STORAGE_KEY, value)
    setPageState(1)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('sortBy', value)
      next.delete('page')
      return next
    }, { replace: true })
  }

  const setPage = (newPage: number) => {
    setPageState(newPage)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newPage > 1) next.set('page', String(newPage))
      else next.delete('page')
      return next
    }, { replace: true })
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['live-teams', { page, sortBy, minutesSince: MINUTES_SINCE }],
    queryFn: () => getLiveTeams({
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      minutesSince: MINUTES_SINCE,
    }),
    // Авто-рефреш раз в 30 секунд: окно «недавности» — 15 минут, поэтому за
    // полминуты страница не успеет «состариться» — выглядит реально живо.
    refetchInterval: 30_000,
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Сейчас аренят</h1>
          <p className={styles.subtitle}>
            Команды, у которых был хотя бы один матч за последние {MINUTES_SINCE} минут.
            {data && <> Найдено: <strong>{data.total}</strong>.</>}
          </p>
        </div>
        <div className={styles.controls}>
          <label className={styles.sortLabel}>
            <span>Сортировка:</span>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="lastBattle">По времени последнего боя</option>
              <option value="rating">По рейтингу</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => refetch()}
            disabled={isFetching}
            title="Обновить вручную"
          >
            ⟳ Обновить
          </button>
        </div>
      </div>

      {isLoading && <div className={styles.center}><Spinner /></div>}
      {error && (
        <ErrorMessage
          message="Не удалось загрузить список «сейчас аренят»"
          onRetry={() => refetch()}
        />
      )}

      {data && data.items.length === 0 && (
        <p className={styles.empty}>
          За последние {MINUTES_SINCE} минут не было ни одного матча.
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.tableWrap} aria-busy={isFetching || undefined}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Команда</th>
                  <th>Сервер</th>
                  <th>Состав</th>
                  <th className={styles.alignRight}>Рейтинг</th>
                  <th>Последний бой</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <LiveTeamRow key={t.id} team={t} />
                ))}
              </tbody>
            </table>
          </div>
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

function LiveTeamRow({ team }: { team: LiveTeam }) {
  const server = zoneToServer(team.zoneId)
  const ratingPatternLabel = team.ratingPattern === 0 ? 'Порядок' : 'Хаос'
  return (
    <tr>
      <td className={styles.teamCell}>
        <Link to={`/teams/${team.id}`} className={styles.teamLink}>
          {team.name || `#${team.id}`}
        </Link>
      </td>
      <td className={styles.serverCell}>{getServerName(team.zoneId)}</td>
      <td>
        <div className={styles.members}>
          {team.members.map((m) => (
            <MemberIcon key={m.playerId} member={m} server={server} />
          ))}
        </div>
      </td>
      <td className={styles.alignRight}>
        <div className={styles.ratingValue}>{Math.trunc(team.rating)}</div>
        <div className={styles.ratingPattern}>{ratingPatternLabel}</div>
      </td>
      <td>
        <Link to={`/matches/${team.lastMatchId}`} className={styles.battleLink}>
          {formatDateTime(team.lastBattleAt)}
        </Link>
      </td>
    </tr>
  )
}

function MemberIcon({ member, server }: { member: LiveTeamMember; server: string }) {
  return (
    <PlayerTooltip
      playerId={member.playerId}
      server={server}
      cls={member.cls}
      name={member.name}
    >
      <Link to={`/players/${server}/${member.playerId}`}>
        <img
          src={getClassIcon(member.cls)}
          alt={getClassName(member.cls)}
          className={styles.memberIcon}
        />
      </Link>
    </PlayerTooltip>
  )
}
