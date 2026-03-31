import { apiGet } from './client'

// === Classes ===

export interface ClassDistribution {
  cls: number
  count: number
  uniquePlayers: number
}

export interface ClassWinrate {
  cls: number
  totalMatches: number
  wins: number
  winRate: number
}

export interface ClassAverageScore {
  cls: number
  averageScore: number
  playerCount: number
}

export interface Composition {
  composition: number[]
  count: number
  wins: number
  winRate: number
}

export function getClassDistribution(matchPattern?: number) {
  return apiGet<ClassDistribution[]>('/api/analytics/classes/distribution', { matchPattern })
}

export function getClassWinrate(matchPattern?: number) {
  return apiGet<ClassWinrate[]>('/api/analytics/classes/winrate', { matchPattern })
}

export function getClassAverageScore(matchPattern?: number) {
  return apiGet<ClassAverageScore[]>('/api/analytics/classes/average-score', { matchPattern })
}

export function getPopularCompositions(params?: { matchPattern?: number; limit?: number }) {
  return apiGet<Composition[]>('/api/analytics/classes/popular-compositions', params)
}

export function getBestCompositions(params?: { matchPattern?: number; minMatches?: number; limit?: number }) {
  return apiGet<Composition[]>('/api/analytics/classes/best-compositions', params)
}

// === Players ===

export interface PlayerProperties {
  hp: number
  mp: number
  damageLow: number
  damageHigh: number
  damageMagicLow: number
  damageMagicHigh: number
  defense: number
  resistance: number
  attack: number
  armor: number
  attackSpeed: number
  runSpeed: number
  attackDegree: number
  defendDegree: number
  critRate: number
  damageReduce: number
  prayspeed: number
  critDamageBonus: number
  invisibleDegree: number
  antiInvisibleDegree: number
  vigour: number
  antiDefenseDegree: number
  antiResistanceDegree: number
  peakGrade: number
}

export interface BattleStat {
  matchPattern: number
  score: number
  winCount: number
  battleCount: number
  winRate: number
}

export interface PlayerCard {
  playerId: number
  server: string
  name: string
  cls: number
  gender: number
  properties: PlayerProperties
  battleStats: BattleStat[]
}

export interface PlayerCompare {
  playerId: number
  server: string
  name: string
  cls: number
  hp: number
  mp: number
  damageLow: number
  damageHigh: number
  damageMagicLow: number
  damageMagicHigh: number
  defense: number
  attack: number
  armor: number
  attackSpeed: number
  runSpeed: number
  attackDegree: number
  defendDegree: number
  critRate: number
  damageReduce: number
  prayspeed: number
  critDamageBonus: number
  invisibleDegree: number
  antiInvisibleDegree: number
  vigour: number
  antiDefenseDegree: number
  antiResistanceDegree: number
  peakGrade: number
}

export interface PropertyHistoryEntry {
  recordedAt: string
  hp: number
  mp: number
  damageLow: number
  damageHigh: number
  damageMagicLow: number
  damageMagicHigh: number
  defense: number
  attack: number
  armor: number
  attackSpeed: number
  critRate: number
  damageReduce: number
  peakGrade: number
  vigour: number
  attackDegree: number
  defendDegree: number
}

export interface StatsDistribution {
  cls: number
  count: number
  min: number
  max: number
  average: number
}

export interface WinrateCorrelation {
  playerId: number
  server: string
  statValue: number
  winRate: number
}

export function getPlayerCard(server: string, playerId: number) {
  return apiGet<PlayerCard>(`/api/analytics/players/${server}/${playerId}/card`)
}

export function comparePlayers(p1Server: string, p1Id: number, p2Server: string, p2Id: number) {
  return apiGet<PlayerCompare[]>('/api/analytics/players/compare', {
    player1Server: p1Server,
    player1Id: p1Id,
    player2Server: p2Server,
    player2Id: p2Id,
  })
}

export function getPropertyHistory(server: string, playerId: number, limit?: number) {
  return apiGet<PropertyHistoryEntry[]>(`/api/analytics/players/${server}/${playerId}/property-history`, { limit })
}

export function getStatsDistribution(stat?: string) {
  return apiGet<StatsDistribution[]>('/api/analytics/players/stats-distribution', { stat })
}

export function getWinrateCorrelation(params?: { stat?: string; matchPattern?: number }) {
  return apiGet<WinrateCorrelation[]>('/api/analytics/players/winrate-correlation', params)
}

// === Time ===

export interface MatchesPerDay {
  date: string
  count: number
}

export interface MatchesPerHour {
  hour: number
  count: number
}

export interface MatchesByDayOfWeek {
  dayOfWeek: number
  count: number
}

export interface HeatmapEntry {
  dayOfWeek: number
  hour: number
  count: number
}

export interface TrendEntry {
  date: string
  matches: number
  teams: number
  players: number
}

export function getMatchesPerDay(params?: { matchPattern?: number; days?: number }) {
  return apiGet<MatchesPerDay[]>('/api/analytics/time/matches-per-day', params)
}

export function getMatchesPerHour(params?: { matchPattern?: number; days?: number }) {
  return apiGet<MatchesPerHour[]>('/api/analytics/time/matches-per-hour', params)
}

export function getMatchesByDayOfWeek(params?: { matchPattern?: number; days?: number }) {
  return apiGet<MatchesByDayOfWeek[]>('/api/analytics/time/matches-by-day-of-week', params)
}

export function getHeatmap(params?: { matchPattern?: number; days?: number }) {
  return apiGet<HeatmapEntry[]>('/api/analytics/time/heatmap', params)
}

export function getTrends(days?: number) {
  return apiGet<TrendEntry[]>('/api/analytics/time/trends', { days })
}

// === Servers ===

export interface ServerOverview {
  server: string
  players: number
  matchParticipations: number
}

export interface ServerAverageScore {
  server: string
  averageScore: number
  playerCount: number
  maxScore: number
  minScore: number
}

export interface ServerPlayerStats {
  server: string
  playerCount: number
  avgHp: number
  avgAttack: number
  avgDefense: number
  avgArmor: number
  avgCritRate: number
  avgPeakGrade: number
  maxPeakGrade: number
}

export interface ServerSummary {
  server: string
  playerCount: number
  arenaPlayerCount: number
  matchCount: number
  averageScore: number
  classDistribution: { cls: number; count: number }[]
  topPlayers: {
    id: number
    name: string
    cls: number
    score: number
    matchPattern: number
    winCount: number
    battleCount: number
  }[]
}

export function getServersOverview() {
  return apiGet<ServerOverview[]>('/api/analytics/servers/overview')
}

export function getServersAverageScore(matchPattern?: number) {
  return apiGet<ServerAverageScore[]>('/api/analytics/servers/average-score', { matchPattern })
}

export function getServersPlayerStats() {
  return apiGet<ServerPlayerStats[]>('/api/analytics/servers/player-stats-comparison')
}

export function getServerSummary(server: string) {
  return apiGet<ServerSummary>(`/api/analytics/servers/${server}/summary`)
}
