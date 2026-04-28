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
  battleStats?: BattleStat[]
  members?: TeamListMember[]
}

/** Краткая информация об участнике (в списке команд) */
export interface TeamListMember {
  playerId: number
  cls: number
  name: string | null
}

/** Команда из live-выборки «сейчас аренят». */
export interface LiveTeam {
  /** Id команды. */
  id: number
  name: string
  zoneId: number
  memberCount: number
  /** Текущий рейтинг команды по паттерну её последнего матча (Score / MemberCount). */
  rating: number
  /** Паттерн последнего матча (0 = Порядок, 1 = Хаос). */
  ratingPattern: number
  /** Когда был последний матч (ISO timestamp). */
  lastBattleAt: string
  /** Id последнего матча — для линка «открыть бой». */
  lastMatchId: number
  /** Состав ИЗ последнего матча (а не статический roster команды). */
  members: LiveTeamMember[]
}

export interface LiveTeamMember {
  playerId: number
  playerServer: string
  cls: number
  name: string | null
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
  scoreHistory?: ScoreHistoryItem[]
}

/** Участник команды (в деталях команды) */
export interface TeamDetailMember {
  playerId: number
  rewardMoneyInfo: number
  playerCls?: number | null
  playerName?: string | null
  playerServer?: string | null
  battleStats?: BattleStat[]
}

/** Участник команды (расширенный) */
export interface TeamMember {
  playerId: number
  rewardMoneyInfo: number
  player: {
    id: number
    name?: string | null
    cls: number
    server?: string | null
    lastBattleTimestamp: number
    lastVisiteTimestamp: number
    battleStats: BattleStat[]
  }
}

/** Статистика H2H (общая) */
export interface H2HStats {
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  lastMatchAt: string
}

/** Статистика H2H по типу боя */
export interface H2HPatternStats extends H2HStats {
  matchPattern: number
  avgScoreChange: number
}

/** Матч в истории H2H */
export interface H2HMatch {
  matchId: number
  matchPattern: number
  isWin: boolean
  teamScoreBefore: number
  teamScoreAfter: number
  opponentScoreBefore: number
  opponentScoreAfter: number
  createdAt: string
}

/** Статистика личных встреч (Head-to-Head) */
export interface TeamH2H {
  teamId: number
  opponentTeamId: number
  team: { id: number; name: string }
  opponent: { id: number; name: string }
  overall: H2HStats
  byMatchPattern: H2HPatternStats[]
  recentMatches: H2HMatch[]
}

/** Элемент списка матчей */
export interface MatchListItem {
  id: number
  matchPattern: number
  teamAId: number
  teamAName?: string
  teamBId: number
  teamBName?: string
  winnerTeamId: number | null
  loserTeamId: number | null
  teamAScoreBefore: number | null
  teamAScoreAfter: number | null
  teamAMemberCount: number | null
  teamBScoreBefore: number | null
  teamBScoreAfter: number | null
  teamBMemberCount: number | null
  createdAt: string
}

/** Участник матча */
export interface MatchParticipant {
  playerId: number
  teamId: number
  playerCls: number
  playerName?: string | null
  playerServer?: string | null
  scoreBefore: number | null
  scoreAfter: number | null
  isWinner: boolean
}

/** Детали матча */
export interface MatchDetail extends MatchListItem {
  participants: MatchParticipant[]
}

/** Свойства игрока в детальном ответе (формат PlayerMaxStatsDto с per-stat баффами) */
export interface PlayerDetailProperties extends PlayerMaxProperties {
  playerId: number
  playerCls?: number | null
  playerName?: string | null
  server: string
  resistance: number[]
  updatedAt: string
}

/** Детали игрока */
export interface PlayerDetail {
  id: number
  teamId: number
  teamName?: string
  cls: number
  server?: string | null
  name?: string | null
  rewardMoney: number
  weekResetTimestamp: number
  lastBattleTimestamp: number
  lastVisiteTimestamp: number
  updatedAt: string
  battleStats: BattleStat[]
  properties?: PlayerDetailProperties
  scoreHistory?: ScoreHistoryItem[]
  team?: { id: number; name: string; zoneId: number }
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
    teamAName?: string
    teamBId: number
    teamBName?: string
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

/** Бафф персонажа */
export interface BuffDto {
  id: number
  name: string
  description?: string | null
  icon?: string | null
}

/** Свойства игрока (характеристики персонажа) */
export interface PlayerProperty {
  playerId: number
  playerCls?: number | null
  playerName?: string | null
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
  buffs: BuffDto[]
  updatedAt: string
}

/** Элемент списка игроков (страница "Игроки") */
export interface PlayerListItem {
  id: number
  name: string | null
  cls: number
  server: string | null
  teamId: number | null
  teamName: string | null
  properties: {
    hp: number
    mp: number
    damageLow: number
    damageHigh: number
    damageMagicLow: number
    damageMagicHigh: number
    defense: number
    resistance: number[]
    attackDegree: number
    defendDegree: number
    vigour: number
    antiDefenseDegree: number
    antiResistanceDegree: number
    peakGrade: number
    hpBuffs: BuffDto[]
    mpBuffs: BuffDto[]
    damageLowBuffs: BuffDto[]
    damageHighBuffs: BuffDto[]
    damageMagicLowBuffs: BuffDto[]
    damageMagicHighBuffs: BuffDto[]
    defenseBuffs: BuffDto[]
    attackDegreeBuffs: BuffDto[]
    defendDegreeBuffs: BuffDto[]
    vigourBuffs: BuffDto[]
    antiDefenseDegreeBuffs: BuffDto[]
    antiResistanceDegreeBuffs: BuffDto[]
    peakGradeBuffs: BuffDto[]
    updatedAt: string
  } | null
}

/** Максимальные значения характеристик игроков */
export interface PlayerMaxProperties {
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
  hpBuffs: BuffDto[]
  mpBuffs: BuffDto[]
  damageLowBuffs: BuffDto[]
  damageHighBuffs: BuffDto[]
  damageMagicLowBuffs: BuffDto[]
  damageMagicHighBuffs: BuffDto[]
  defenseBuffs: BuffDto[]
  resistanceBuffs: BuffDto[]
  attackBuffs: BuffDto[]
  armorBuffs: BuffDto[]
  attackSpeedBuffs: BuffDto[]
  runSpeedBuffs: BuffDto[]
  attackDegreeBuffs: BuffDto[]
  defendDegreeBuffs: BuffDto[]
  critRateBuffs: BuffDto[]
  damageReduceBuffs: BuffDto[]
  prayspeedBuffs: BuffDto[]
  critDamageBonusBuffs: BuffDto[]
  invisibleDegreeBuffs: BuffDto[]
  antiInvisibleDegreeBuffs: BuffDto[]
  vigourBuffs: BuffDto[]
  antiDefenseDegreeBuffs: BuffDto[]
  antiResistanceDegreeBuffs: BuffDto[]
  peakGradeBuffs: BuffDto[]
}

/** Результат пересборки матчей */
export interface RebuildResult {
  matchesCreated: number
  participantsCreated: number
  teamPairsFound: number
  unpairedTeams: number
  totalTeamsWithBattles: number
}
