/** Пагинированный ответ от API */
export interface PaginatedResponse<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

/** Элемент списка команд */
export interface TeamListItem {
  id: number
  captainId: number
  zoneId: number
  name: string
  weekResetTimestamp: number
  lastVisiteTimestamp: number
  updatedAt: string
  memberCount: number
  ratingChaos?: number
  ratingOrder?: number
  realRating?: number
}

/** Боевая статистика */
export interface BattleStat {
  matchPattern: number
  score: number
  winCount: number
  battleCount: number
  weekBattleCount: number
  weekWinCount: number
  weekMaxScore: number
  rank: number
}

/** Детали команды */
export interface TeamDetail {
  id: number
  captainId: number
  zoneId: number
  name: string
  weekResetTimestamp: number
  lastVisiteTimestamp: number
  updatedAt: string
  members: TeamDetailMember[]
  battleStats: BattleStat[]
}

/** Участник команды (в деталях команды) */
export interface TeamDetailMember {
  playerId: number
  rewardMoneyInfo: number
}

/** Участник команды (расширенный) */
export interface TeamMember {
  playerId: number
  rewardMoneyInfo: number
  player: {
    id: number
    cls: number
    lastBattleTimestamp: number
    lastVisiteTimestamp: number
    battleStats: BattleStat[]
  }
}

/** Элемент списка матчей */
export interface MatchListItem {
  id: number
  matchPattern: number
  teamAId: number
  teamBId: number
  winnerTeamId: number | null
  loserTeamId: number | null
  teamAScoreBefore: number | null
  teamAScoreAfter: number | null
  teamBScoreBefore: number | null
  teamBScoreAfter: number | null
  createdAt: string
}

/** Участник матча */
export interface MatchParticipant {
  playerId: number
  teamId: number
  playerCls: number
  scoreBefore: number | null
  scoreAfter: number | null
  isWinner: boolean
}

/** Детали матча */
export interface MatchDetail extends MatchListItem {
  participants: MatchParticipant[]
}

/** Детали игрока */
export interface PlayerDetail {
  id: number
  teamId: number
  cls: number
  rewardMoney: number
  weekResetTimestamp: number
  lastBattleTimestamp: number
  lastVisiteTimestamp: number
  updatedAt: string
  battleStats: BattleStat[]
}

/** Матч игрока */
export interface PlayerMatchItem {
  matchId: number
  teamId: number
  playerCls: number
  scoreBefore: number | null
  scoreAfter: number | null
  isWinner: boolean
  match: {
    matchPattern: number
    teamAId: number
    teamBId: number
    winnerTeamId: number | null
    createdAt: string
  }
}

/** Элемент истории рейтинга */
export interface ScoreHistoryItem {
  matchPattern: number
  score: number
  winCount: number
  battleCount: number
  recordedAt: string
}

/** Свойства игрока (характеристики персонажа) */
export interface PlayerProperty {
  playerId: number
  server: string
  hp: number
  mp: number
  damageLow: number
  damageHigh: number
  damageMagicLow: number
  damageMagicHigh: number
  defense: number
  resistance: number[]
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
  updatedAt: string
}

/** Результат пересборки матчей */
export interface RebuildResult {
  matchesCreated: number
  participantsCreated: number
  teamPairsFound: number
  unpairedTeams: number
  totalTeamsWithBattles: number
}
