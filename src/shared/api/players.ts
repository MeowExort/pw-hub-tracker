import { apiGet, apiPost } from './client'
import type {
  PaginatedResponse,
  PlayerDetail,
  PlayerMatchItem,
  PlayerProperty,
  ScoreHistoryItem,
} from '@/shared/types/api'

/** Получить детали игрока */
export function getPlayerById(server: string, playerId: number, include?: string) {
  return apiGet<PlayerDetail>(`/api/arena/players/${server}/${playerId}`, include ? { include } : undefined)
}

/** Параметры запроса матчей игрока */
export interface GetPlayerMatchesParams {
  matchPattern?: number
  page?: number
  pageSize?: number
}

/** Получить матчи игрока */
export function getPlayerMatches(server: string, playerId: number, params?: GetPlayerMatchesParams) {
  return apiGet<PaginatedResponse<PlayerMatchItem>>(
    `/api/arena/players/${server}/${playerId}/matches`,
    params as Record<string, number | undefined>,
  )
}

/** Параметры запроса истории рейтинга игрока */
export interface GetPlayerScoreHistoryParams {
  matchPattern?: number
  limit?: number
}

/** Получить историю рейтинга игрока */
export function getPlayerScoreHistory(server: string, playerId: number, params?: GetPlayerScoreHistoryParams) {
  return apiGet<ScoreHistoryItem[]>(
    `/api/arena/players/${server}/${playerId}/score-history`,
    params as Record<string, number | undefined>,
  )
}

/** Получить характеристики игроков по массиву ID */
export function getPlayerPropertiesByIds(players: { Id: number; Server: string }[]) {
  return apiPost<PlayerProperty[]>('/api/players/properties/by-ids', players)
}
