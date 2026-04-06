import { apiGet, apiPost } from './client'
import type {
  PaginatedResponse,
  PlayerDetail,
  PlayerDetailProperties,
  PlayerListItem,
  PlayerMatchItem,
  PlayerMaxProperties,
  ScoreHistoryItem,
} from '@/shared/types/api'

/** Параметры запроса списка игроков */
export interface GetPlayersParams {
  page?: number
  pageSize?: number
  search?: string
  server?: string
  cls?: number
  sortBy?:
    | 'hp'
    | 'defense'
    | 'resistance'
    | 'damage'
    | 'damageMagic'
    | 'attackDegree'
    | 'defendDegree'
    | 'vigour'
    | 'antiDefenseDegree'
    | 'antiResistanceDegree'
    | 'peakGrade'
  sortOrder?: 'asc' | 'desc'
  hpMin?: number
  hpMax?: number
  defenseMin?: number
  defenseMax?: number
  resistanceMin?: number
  resistanceMax?: number
  damageLowMin?: number
  damageHighMax?: number
  damageMagicLowMin?: number
  damageMagicHighMax?: number
  attackDegreeMin?: number
  attackDegreeMax?: number
  defendDegreeMin?: number
  defendDegreeMax?: number
  vigourMin?: number
  vigourMax?: number
  antiDefenseDegreeMin?: number
  antiDefenseDegreeMax?: number
  antiResistanceDegreeMin?: number
  antiResistanceDegreeMax?: number
  peakGradeMin?: number
  peakGradeMax?: number
}

/** Получить список игроков с пагинацией, поиском, фильтрацией и сортировкой */
export function getPlayers(params?: GetPlayersParams) {
  return apiGet<PaginatedResponse<PlayerListItem>>(
    '/api/players',
    params as Record<string, string | number | undefined>,
  )
}

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

/** Получить максимальные значения характеристик */
export function getPlayerPropertiesMax() {
  return apiGet<PlayerMaxProperties>('/api/players/properties/max')
}

/** Получить характеристики игроков по массиву ID */
export function getPlayerPropertiesByIds(players: { Id: number; Server: string }[]) {
  return apiPost<PlayerDetailProperties[]>('/api/players/properties/by-ids', players)
}
