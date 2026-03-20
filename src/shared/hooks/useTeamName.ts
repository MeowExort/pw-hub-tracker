import { useQuery, useQueries } from '@tanstack/react-query'
import { getTeamById } from '@/shared/api/teams'

const TEAM_STALE_TIME = 5 * 60 * 1000

/** Получить название команды по ID (с кэшированием через react-query) */
export function useTeamName(teamId: number | null | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeamById(teamId!),
    enabled: !!teamId,
    staleTime: TEAM_STALE_TIME,
  })
  return data?.name
}

/** Хук для получения названий нескольких команд по их ID */
export function useTeamNames(teamIds: number[]): Record<number, string> {
  const unique = [...new Set(teamIds.filter(Boolean))]

  const queries = useQueries({
    queries: unique.map((id) => ({
      queryKey: ['team', id],
      queryFn: () => getTeamById(id),
      staleTime: TEAM_STALE_TIME,
      enabled: !!id,
    })),
  })

  const result: Record<number, string> = {}
  unique.forEach((id, i) => {
    const name = queries[i]?.data?.name
    if (name) result[id] = name
  })
  return result
}
