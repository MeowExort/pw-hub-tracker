import { apiGet } from './client'
import type { PaginatedResponse, MatchListItem, MatchDetail } from '@/shared/types/api'

/** Параметры запроса списка матчей */
export interface GetMatchesParams {
  matchPattern?: number
  teamId?: number
  page?: number
  pageSize?: number
}

/** Получить список матчей */
export function getMatches(params?: GetMatchesParams) {
  return apiGet<PaginatedResponse<MatchListItem>>('/api/arena/matches', params as Record<string, number | undefined>)
}

/** Получить детали матча */
export function getMatchById(matchId: number) {
  return apiGet<MatchDetail>(`/api/arena/matches/${matchId}`)
}
