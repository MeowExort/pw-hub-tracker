import { apiGet } from './client'
import type {
  PaginatedResponse,
  TeamListItem,
  TeamDetail,
  TeamMember,
  MatchListItem,
  ScoreHistoryItem,
} from '@/shared/types/api'

/** Параметры запроса списка команд */
export interface GetTeamsParams {
  zoneId?: number
  page?: number
  pageSize?: number
}

/** Получить список команд */
export function getTeams(params?: GetTeamsParams) {
  return apiGet<PaginatedResponse<TeamListItem>>('/api/arena/teams', params as Record<string, number | undefined>)
}

/** Получить детали команды */
export function getTeamById(teamId: number) {
  return apiGet<TeamDetail>(`/api/arena/teams/${teamId}`)
}

/** Получить участников команды */
export function getTeamMembers(teamId: number) {
  return apiGet<TeamMember[]>(`/api/arena/teams/${teamId}/members`)
}

/** Параметры запроса матчей команды */
export interface GetTeamMatchesParams {
  matchPattern?: number
  page?: number
  pageSize?: number
}

/** Получить матчи команды */
export function getTeamMatches(teamId: number, params?: GetTeamMatchesParams) {
  return apiGet<PaginatedResponse<MatchListItem>>(
    `/api/arena/teams/${teamId}/matches`,
    params as Record<string, number | undefined>,
  )
}

/** Параметры запроса истории рейтинга команды */
export interface GetScoreHistoryParams {
  matchPattern?: number
  limit?: number
}

/** Получить историю рейтинга команды */
export function getTeamScoreHistory(teamId: number, params?: GetScoreHistoryParams) {
  return apiGet<ScoreHistoryItem[]>(
    `/api/arena/teams/${teamId}/score-history`,
    params as Record<string, number | undefined>,
  )
}
