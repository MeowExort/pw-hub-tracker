import { apiGet } from './client'
import type {
  PlayerLoadoutResponse,
  LoadoutTimelineEntry,
} from '@/shared/types/loadout'

/** Последний loadout (equipment + skill_runes + soul_relics в окне ±1 минута). */
export function getPlayerLoadoutLatest(server: string, playerId: number): Promise<PlayerLoadoutResponse> {
  return apiGet<PlayerLoadoutResponse>(`/api/players/${server}/${playerId}/loadout/latest`)
}

/** Loadout на момент времени (anchor — последний equipment до `at`). */
export function getPlayerLoadoutAt(server: string, playerId: number, at: string): Promise<PlayerLoadoutResponse> {
  return apiGet<PlayerLoadoutResponse>(`/api/players/${server}/${playerId}/loadout/at`, { at })
}

/** Список «комплектов» loadout-ов для UI-таймлайна (DESC по времени). */
export function getPlayerLoadoutHistory(
  server: string,
  playerId: number,
  params?: { before?: string; limit?: number },
): Promise<LoadoutTimelineEntry[]> {
  return apiGet<LoadoutTimelineEntry[]>(`/api/players/${server}/${playerId}/loadout/history`, params)
}

/** Один equipment-снапшот с anchor-окном. */
export function getEquipmentSnapshot(server: string, playerId: number, snapshotId: number): Promise<PlayerLoadoutResponse> {
  return apiGet<PlayerLoadoutResponse>(`/api/players/${server}/${playerId}/equipment/snapshots/${snapshotId}`)
}

export function getSkillRunesSnapshot(server: string, playerId: number, snapshotId: number): Promise<PlayerLoadoutResponse> {
  return apiGet<PlayerLoadoutResponse>(`/api/players/${server}/${playerId}/skill-runes/snapshots/${snapshotId}`)
}

export function getSoulRelicsSnapshot(server: string, playerId: number, snapshotId: number): Promise<PlayerLoadoutResponse> {
  return apiGet<PlayerLoadoutResponse>(`/api/players/${server}/${playerId}/soul-relics/snapshots/${snapshotId}`)
}
