import {useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {getTeamById, getTeamMatches, getTeamMembers} from '@/shared/api/teams'
import {Spinner} from '@/shared/ui/Spinner'
import {ErrorMessage} from '@/shared/ui/ErrorMessage'
import {Pagination} from '@/shared/ui/Pagination'
import {
    formatDateTime,
    formatScoreDelta,
    getClassIcon,
    getClassName,
    getMatchPatternName,
    getServerName,
} from '@/shared/utils/format'
import {ScoreChart} from './ScoreChart'
import {MembersSection} from './MembersSection'
import {PlayerTooltip} from '@/shared/ui/PlayerTooltip'
import {TeamTooltip} from '@/shared/ui/TeamTooltip'
import {MatchTooltip} from '@/shared/ui/MatchTooltip'
import styles from './TeamDetailPage.module.scss'

const PAGE_SIZE = 20

/** Страница деталей команды — вариант B: Sidebar + Content */
export function TeamDetailPage() {
    const {teamId} = useParams<{ teamId: string }>()
    const id = Number(teamId)
    const [matchPage, setMatchPage] = useState(1)
    const [matchPattern, setMatchPattern] = useState<number | undefined>()

    const teamQuery = useQuery({
        queryKey: ['team', id],
        queryFn: () => getTeamById(id, 'scorehistory'),
        enabled: !!id,
    })

    const membersQuery = useQuery({
        queryKey: ['teamMembers', id],
        queryFn: () => getTeamMembers(id),
        enabled: !!id,
    })

    const matchesQuery = useQuery({
        queryKey: ['teamMatches', id, {page: matchPage, matchPattern}],
        queryFn: () => getTeamMatches(id, {page: matchPage, pageSize: PAGE_SIZE, matchPattern}),
        enabled: !!id,
    })

    if (teamQuery.isLoading) {
        return <div className={styles.center}><Spinner/></div>
    }

    if (teamQuery.error) {
        return <ErrorMessage message="Не удалось загрузить команду" onRetry={() => teamQuery.refetch()}/>
    }

    const team = teamQuery.data
    if (!team) return null

    const scoreHistory = team.scoreHistory
    const memberCount = team.members.length || 1

    // Найти капитана
    const captain = membersQuery.data?.find((m) => m.playerId === team.captainId)

    return (
        <div className={styles.layout}>
            {/* ===== SIDEBAR ===== */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <h1 className={styles.teamName}>{team.name}</h1>
                    <span className={styles.zone}>{getServerName(team.zoneId)}</span>
                    <span className={styles.memberCount}>👥 {team.members.length} участников</span>
                </div>

                {/* Рейтинги */}
                {team.battleStats.map((stat) => {
                    const wr = stat.battleCount > 0
                        ? Math.round((stat.winCount / stat.battleCount) * 100)
                        : 0
                    const wrColor = wr >= 60 ? 'var(--success)' : wr >= 50 ? 'var(--warning)' : 'var(--danger)'
                    return (
                        <div key={stat.matchPattern} className={styles.sideRating}>
                            <div className={styles.sideRatingTitle}>
                                {stat.matchPattern === 0 ? '⚔ Порядок' : '💀 Хаос'}
                            </div>
                            <div className={styles.sideRatingScore}>
                                {Math.trunc(stat.score / memberCount)}
                                <span className={styles.sideRatingRank}>#{stat.rank}</span>
                            </div>
                            <div className={styles.sideWrBar}>
                                <div className={styles.sideWrTrack}>
                                    <div
                                        className={styles.sideWrFill}
                                        style={{width: `${wr}%`, background: wrColor}}
                                    />
                                </div>
                                <span className={styles.sideWrLabel}>{wr}%</span>
                            </div>
                            <div className={styles.sideRatingMeta}>
                                {stat.battleCount} боёв · {stat.winCount}W
                            </div>
                            <div className={styles.sideRatingMeta}>
                                Нед: {stat.weekBattleCount}б / {stat.weekWinCount}W
                            </div>
                        </div>
                    )
                })}

                {/* Капитан */}
                {captain && (
                    <div className={styles.sideCaptain}>
                        <div className={styles.sideSectionLabel}>Капитан</div>
                        <PlayerTooltip
                            playerId={captain.playerId}
                            server={captain.player?.server ?? getServerName(team.zoneId)}
                            cls={captain.player?.cls ?? 0}
                            name={captain.player?.name ?? null}
                            isCaptain
                        >
                            <Link
                                to={`/players/${captain.player?.server ?? getServerName(team.zoneId)}/${captain.playerId}`}
                                className={styles.captainLink}
                            >
                                <img src={getClassIcon(captain.player?.cls ?? 0)}
                                     alt={getClassName(captain.player?.cls ?? 0)}
                                     style={{width: 20, height: 20, verticalAlign: 'middle', marginRight: 4}}/>
                                {captain.player?.name ?? `Игрок #${captain.playerId}`}
                            </Link>
                        </PlayerTooltip>
                    </div>
                )}
            </aside>

            {/* ===== CONTENT ===== */}
            <main className={styles.content}>
                {/* График рейтинга */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>📈 График рейтинга</h2>
                    {teamQuery.isLoading && <div className={styles.center}><Spinner size="sm"/></div>}
                    {scoreHistory && scoreHistory.length > 0 && (
                        <ScoreChart data={scoreHistory} memberCount={memberCount}/>
                    )}
                    {scoreHistory && scoreHistory.length === 0 && (
                        <p className={styles.empty}>Нет данных истории рейтинга</p>
                    )}
                    {!scoreHistory && !teamQuery.isLoading && (
                        <p className={styles.empty}>Нет данных истории рейтинга</p>
                    )}
                </div>

                {/* Участники */}
                <div className={styles.section}>
                    {membersQuery.isLoading && <div className={styles.center}><Spinner size="sm"/></div>}
                    {membersQuery.data && (
                        <MembersSection members={membersQuery.data} captainId={team.captainId}/>
                    )}
                </div>

                {/* Матчи */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>⚔ Матчи</h2>
                        <select
                            className={styles.select}
                            value={matchPattern ?? ''}
                            onChange={(e) => {
                                setMatchPattern(e.target.value ? Number(e.target.value) : undefined)
                                setMatchPage(1)
                            }}
                        >
                            <option value="">Все типы</option>
                            <option value="0">Порядок</option>
                            <option value="1">Хаос</option>
                        </select>
                    </div>
                    {matchesQuery.isLoading && <div className={styles.center}><Spinner size="sm"/></div>}
                    {matchesQuery.data && (
                        <>
                            <table className={styles.table}>
                                <thead>
                                <tr>
                                    <th>Матч</th>
                                    <th>Тип боя</th>
                                    <th>Противник</th>
                                    <th>Δ Рейтинг</th>
                                    <th>Дата</th>
                                </tr>
                                </thead>
                                <tbody>
                                {matchesQuery.data.items.map((match) => {
                                    const isTeamA = match.teamAId === id
                                    const won = match.winnerTeamId === id
                                    const lost = match.loserTeamId === id
                                    const opponentId = isTeamA ? match.teamBId : match.teamAId
                                    const opponentName = isTeamA ? (match.teamBName ?? match.teamBId) : (match.teamAName ?? match.teamAId)
                                    return (
                                        <tr key={match.id} className={won ? styles.win : lost ? styles.loss : ''}>
                                            <td>
                                                <MatchTooltip matchId={match.id}>
                                                    <Link to={`/matches/${match.id}`}>#{match.id}</Link>
                                                </MatchTooltip>
                                            </td>
                                            <td>{getMatchPatternName(match.matchPattern)}</td>
                                            <td>
                                                <TeamTooltip teamId={opponentId} teamName={String(opponentName)} currentTeamId={id}>
                                                    <Link to={`/teams/${opponentId}`}>{opponentName}</Link>
                                                </TeamTooltip>
                                            </td>
                                            <td>
                                                {isTeamA
                                                    ? formatScoreDelta(match.teamAScoreBefore, match.teamAScoreAfter)
                                                    : formatScoreDelta(match.teamBScoreBefore, match.teamBScoreAfter)}
                                            </td>
                                            <td className={styles.date}>{formatDateTime(match.createdAt)}</td>
                                        </tr>
                                    )
                                })}
                                </tbody>
                            </table>
                            <Pagination
                                page={matchPage}
                                total={matchesQuery.data.total}
                                pageSize={PAGE_SIZE}
                                onPageChange={setMatchPage}
                            />
                        </>
                    )}
                </div>
            </main>
        </div>
    )
}
