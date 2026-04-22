import {useEffect, useMemo, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {
    getShopProfile,
    PSHOP_SERVERS,
    type PShopServer,
    type ShopItemExtended,
    type Sparkline as SparklineData,
} from '@/shared/api/pshop'
import {getPlayerById} from '@/shared/api/players'
import {Spinner} from '@/shared/ui/Spinner'
import {ErrorMessage} from '@/shared/ui/ErrorMessage'
import {ItemTooltip} from '@/shared/ui/ItemTooltip/ItemTooltip'
import {PlayerTooltip} from '@/shared/ui/PlayerTooltip'
import {getClassIcon, getClassName} from '@/shared/utils/format'
import {formatDate, formatNumber, formatSeconds} from '@/shared/utils/pshop'
import { ClearableInput } from '@/shared/ui/ClearableInput'
import { SERVER_LABELS } from '@/shared/ui/ServerSelector/ServerSelector'
import styles from './ShopProfilePage.module.scss'

type ViewMode = 'grid' | 'table'
type SortKey = 'default' | 'priceAsc' | 'priceDesc' | 'countDesc' | 'vsMarket'

/** Инлайн SVG-спарклайн на основе агрегированных точек Sparkline (B1). */
function Sparkline({sparkline, isSell}: { sparkline: SparklineData | undefined; isSell: boolean }) {
    const points = useMemo(() => {
        if (!sparkline?.points?.length) return [] as number[]
        return sparkline.points
            .map((p) => (isSell ? p.sellMedian : p.buyMedian))
            .filter((v): v is number => typeof v === 'number' && v > 0)
    }, [sparkline, isSell])

    if (points.length < 2) return <div className={styles.sparkEmpty}/>

    const w = 80
    const h = 24
    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    const step = points.length > 1 ? w / (points.length - 1) : 0
    const path = points
        .map((v, i) => {
            const x = i * step
            const y = h - ((v - min) / range) * h
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')

    const trend = points[points.length - 1] - points[0]
    const color = trend > 0 ? 'var(--danger)' : trend < 0 ? 'var(--success)' : 'var(--text-secondary)'

    return (
        <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <path d={path} fill="none" stroke={color} strokeWidth={1.5}/>
        </svg>
    )
}

interface ShopItemCardProps {
    item: ShopItemExtended
    marketAvg: number | null
    sparkline: SparklineData | undefined
    server: string
}

function ShopItemCard({item, marketAvg, sparkline, server}: ShopItemCardProps) {
    let vsMarket: string | null = null
    let vsClass = ''
    if (marketAvg && marketAvg > 0) {
        const diff = ((item.price - marketAvg) / marketAvg) * 100
        vsMarket = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`
        vsClass = diff > 0 ? styles.negative : styles.positive
    }

    const name = item.item?.name ?? `#${item.itemId}`
    const nameColor = item.item?.nameColor || undefined

    return (
        <div className={styles.showcaseCard}>
            <ItemTooltip
                itemId={item.itemId}
                server={server}
                name={name}
                icon={item.item?.icon ?? ''}
                nameColor={item.item?.nameColor ?? ''}
                count={item.itemCount}
                price={item.price}
                sparkline={sparkline}
            >
                <div className={styles.showcaseIconWrap}>
                    <img src={item.item?.icon ?? ''} alt={name} className={styles.showcaseIcon}/>
                    <span className={styles.showcaseCount}>{formatNumber(item.itemCount)}</span>
                </div>
            </ItemTooltip>

            <div className={styles.showcaseBody}>
                <Link
                    to={`/items/${item.itemId}`}
                    className={styles.showcaseName}
                    style={nameColor ? {color: nameColor} : undefined}
                    title={name}
                >
                    {name}
                </Link>
                <div className={styles.showcaseRow}>
                    <span className={styles.showcasePrice}>{formatNumber(item.price)}</span>
                    {vsMarket && (
                        <span className={`${styles.showcaseVs} ${vsClass}`} title={
                            marketAvg ? `Сред. по рынку: ${formatNumber(Math.round(marketAvg))}` : ''
                        }>
                            {vsMarket}
                        </span>
                    )}
                </div>
                <div className={styles.showcaseRow}>
                    <Sparkline sparkline={sparkline} isSell={item.isSell}/>
                    <Link
                        to={`/items/${item.itemId}`}
                        className={styles.showcaseMarketLink}
                        title="Открыть предмет на рынке"
                    >
                        → Рынок
                    </Link>
                </div>
            </div>

            <Link
                to={`/shops?hasItemId=${item.itemId}&side=${item.isSell ? 'sell' : 'buy'}&server=${server}`}
                className={styles.showcaseCompetitors}
                title="Другие магазины с этим предметом"
            >
                Конкуренты
            </Link>
        </div>
    )
}

/** Компактная карточка-строка для table-режима */
function ShopItemRow({item, marketAvg, sparkline}: Omit<ShopItemCardProps, 'server'>) {
    let vsMarket: string | null = null
    let vsClass = ''
    if (marketAvg && marketAvg > 0) {
        const diff = ((item.price - marketAvg) / marketAvg) * 100
        vsMarket = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`
        vsClass = diff > 0 ? styles.negative : styles.positive
    }
    const name = item.item?.name ?? `#${item.itemId}`

    return (
        <tr>
            <td>
                <Link to={`/items/${item.itemId}`} className={styles.itemNameCell}>
                    <img src={item.item?.icon ?? ''} alt="" className={styles.itemIcon}/>
                    <span style={item.item?.nameColor ? {color: item.item.nameColor} : undefined}>{name}</span>
                </Link>
            </td>
            <td>{formatNumber(item.itemCount)}</td>
            <td>{formatNumber(item.price)}</td>
            <td className={vsClass}>{vsMarket ?? '—'}</td>
            <td><Sparkline sparkline={sparkline} isSell={item.isSell}/></td>
        </tr>
    )
}

/** Страница «Профиль магазина игрока» — вариант C (inventory-first) */
export function ShopProfilePage() {
    const {server, playerId} = useParams<{ server: string; playerId: string }>()
    const pid = Number(playerId)

    const [showBotEvents, setShowBotEvents] = useState(false)
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('default')
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try {
            const saved = localStorage.getItem('shopProfile.viewMode')
            return saved === 'grid' || saved === 'table' ? saved : 'grid'
        } catch {
            return 'grid'
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem('shopProfile.viewMode', viewMode)
        } catch {
            /* ignore */
        }
    }, [viewMode])

    const validServer = PSHOP_SERVERS.includes(server as PShopServer)

    // B1: единый запрос shop + player + botScore + spread[] + sparkline[] вместо 3 + 2×N.
    const profile = useQuery({
        queryKey: ['shop-profile-v2', server, pid],
        queryFn: () => getShopProfile(server!, pid, { historyDays: 7, sparklinePoints: 24 }),
        enabled: validServer && !isNaN(pid),
    })

    // playerInfo даёт properties (классы/статы) — это не рыночные данные, остаётся отдельным запросом.
    const playerInfo = useQuery({
        queryKey: ['player-detail', server, pid],
        queryFn: () => getPlayerById(server!, pid, 'properties'),
        enabled: validServer && !isNaN(pid),
    })

    const shop = { data: profile.data?.shop, isLoading: profile.isLoading, error: profile.error }
    const botScore = { data: profile.data?.botScore }

    const spreadMap = useMemo(() => {
        const map = new Map<number, { sell: number | null; buy: number | null }>()
        profile.data?.items.forEach((row) => {
            map.set(row.itemId, {
                sell: row.spread.sell?.min ?? null,
                buy: row.spread.buy?.max ?? null,
            })
        })
        return map
    }, [profile.data])

    const sparklineMap = useMemo(() => {
        const map = new Map<number, SparklineData>()
        profile.data?.items.forEach((row) => {
            map.set(row.itemId, row.sparkline)
        })
        return map
    }, [profile.data])

    const allItems: ShopItemExtended[] = useMemo(
        () =>
            (profile.data?.items ?? []).map((row) => ({
                id: row.id,
                itemId: row.itemId,
                item: row.item,
                itemCount: row.itemCount,
                price: row.price,
                isSell: row.isSell,
            })),
        [profile.data],
    )

    const applyFilterAndSort = (items: ShopItemExtended[]): ShopItemExtended[] => {
        const q = search.trim().toLowerCase()
        let out = items
        if (q) {
            out = out.filter((i) => (i.item?.name ?? '').toLowerCase().includes(q))
        }
        const vs = (i: ShopItemExtended): number => {
            const avg = i.isSell ? spreadMap.get(i.itemId)?.sell : spreadMap.get(i.itemId)?.buy
            if (!avg || avg <= 0) return 0
            return ((i.price - avg) / avg) * 100
        }
        const sorted = [...out]
        switch (sortKey) {
            case 'priceAsc':
                sorted.sort((a, b) => a.price - b.price);
                break
            case 'priceDesc':
                sorted.sort((a, b) => b.price - a.price);
                break
            case 'countDesc':
                sorted.sort((a, b) => b.itemCount - a.itemCount);
                break
            case 'vsMarket':
                sorted.sort((a, b) => vs(a) - vs(b));
                break
            default:
                break
        }
        return sorted
    }

    const sellItems = useMemo(() => applyFilterAndSort(allItems.filter((i) => i.isSell)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allItems, search, sortKey, spreadMap])
    const buyItems = useMemo(() => applyFilterAndSort(allItems.filter((i) => !i.isSell)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allItems, search, sortKey, spreadMap])

    /* KPI магазина */
    const kpis = useMemo(() => {
        const sell = allItems.filter((i) => i.isSell)
        const buy = allItems.filter((i) => !i.isSell)
        const turnover = sell.reduce((s, i) => s + i.price * i.itemCount, 0)
        const budget = buy.reduce((s, i) => s + i.price * i.itemCount, 0)
        const diffs: number[] = []
        allItems.forEach((i) => {
            const avg = i.isSell ? spreadMap.get(i.itemId)?.sell : spreadMap.get(i.itemId)?.buy
            if (avg && avg > 0) diffs.push(((i.price - avg) / avg) * 100)
        })
        const avgVs = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : null
        return {
            sellCount: sell.length,
            buyCount: buy.length,
            turnover,
            budget,
            avgVs,
        }
    }, [allItems, spreadMap])

    const botScorePercent = useMemo(() => {
        if (!botScore.data) return 0
        return Math.min(100, Math.round((botScore.data.totalEvents / 50) * 100))
    }, [botScore.data])

    const botScoreColor = botScorePercent > 60 ? 'var(--danger)' : botScorePercent > 30 ? '#e67e22' : 'var(--success)'

    if (!validServer) {
        return <ErrorMessage message={`Неизвестный сервер: ${server}. Допустимые: ${PSHOP_SERVERS.join(', ')}`}/>
    }

    if (isNaN(pid)) {
        return <ErrorMessage message="Некорректный ID игрока"/>
    }

    if (shop.isLoading) {
        return <div className={styles.center}><Spinner/></div>
    }

    if (shop.error) {
        return (
            <ErrorMessage message={
                (shop.error as any)?.status === 404
                    ? 'Магазин не найден'
                    : (shop.error as Error).message
            }/>
        )
    }

    const playerName = playerInfo.data?.name ?? `Игрок #${pid}`
    const cls = playerInfo.data?.cls

    const renderShowcase = (items: ShopItemExtended[], isSell: boolean) => {
        if (!items.length) {
            return <div className={styles.empty}>Нет товаров</div>
        }
        if (viewMode === 'table') {
            return (
                <table className={styles.showcaseTable}>
                    <thead>
                    <tr>
                        <th>Предмет</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        <th>vs рынок</th>
                        <th>7д</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((item) => (
                        <ShopItemRow
                            key={`${item.itemId}-${item.isSell}-${item.id}`}
                            item={item}
                            marketAvg={(isSell ? spreadMap.get(item.itemId)?.sell : spreadMap.get(item.itemId)?.buy) ?? null}
                            sparkline={sparklineMap.get(item.itemId)}
                        />
                    ))}
                    </tbody>
                </table>
            )
        }
        return (
            <div className={styles.showcaseGrid}>
                {items.map((item) => (
                    <ShopItemCard
                        key={`${item.itemId}-${item.isSell}-${item.id}`}
                        item={item}
                        marketAvg={(isSell ? spreadMap.get(item.itemId)?.sell : spreadMap.get(item.itemId)?.buy) ?? null}
                        sparkline={sparklineMap.get(item.itemId)}
                        server={server!}
                    />
                ))}
            </div>
        )
    }

    const sectionAggregate = (items: ShopItemExtended[], isSell: boolean) => {
        const count = items.length
        const volume = items.reduce((s, i) => s + i.price * i.itemCount, 0)
        const diffs: number[] = []
        items.forEach((i) => {
            const avg = isSell ? spreadMap.get(i.itemId)?.sell : spreadMap.get(i.itemId)?.buy
            if (avg && avg > 0) diffs.push(((i.price - avg) / avg) * 100)
        })
        const avgVs = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : null
        return (
            <div className={styles.sectionAggregate}>
                <span>Позиций: <b>{count}</b></span>
                <span>{isSell ? 'Оборот' : 'Бюджет'}: <b>{formatNumber(volume)}</b></span>
                {avgVs !== null && (
                    <span>
                        Ср. vs рынок:{' '}
                        <b className={avgVs > 0 ? styles.negative : styles.positive}>
                            {avgVs > 0 ? '+' : ''}{avgVs.toFixed(1)}%
                        </b>
                    </span>
                )}
            </div>
        )
    }

    return (
        <div>
            <div className={styles.breadcrumbs}>
                <Link to="/shops">Магазины</Link> → {SERVER_LABELS[server as PShopServer] ?? server} → {playerId}
            </div>

            <div className={styles.layout}>
                {/* ===== STICKY SIDEBAR ===== */}
                <aside className={styles.sidebar}>
                    <div className={styles.playerCard}>
                        {cls != null && (
                            <img
                                src={getClassIcon(cls)}
                                alt={getClassName(cls)}
                                className={styles.playerClassIcon}
                                width={48}
                                height={48}
                            />
                        )}
                        <div className={styles.playerCardInfo}>
                            {playerInfo.data?.name ? (
                                <PlayerTooltip
                                    playerId={pid}
                                    server={server!}
                                    cls={cls}
                                    name={playerName}
                                >
                                    <Link to={`/players/${server}/${pid}`} className={styles.playerName}>
                                        {playerName}
                                    </Link>
                                </PlayerTooltip>
                            ) : (
                                <span className={styles.playerName}>{playerName}</span>
                            )}
                            <div className={styles.playerMeta}>
                                <span className={styles.metaChip}>{SERVER_LABELS[server as PShopServer] ?? server}</span>
                                {shop.data && (
                                    <span
                                        className={`${styles.badge} ${shop.data.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                                        {shop.data.isActive ? '● Активен' : '○ Неактивен'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* KPI chips */}
                    <div className={styles.kpiChips}>
                        <div className={styles.kpiChip}>
                            <span className={styles.kpiLabel}>Продажа</span>
                            <span className={styles.kpiValue}>{kpis.sellCount}</span>
                        </div>
                        <div className={styles.kpiChip}>
                            <span className={styles.kpiLabel}>Скупка</span>
                            <span className={styles.kpiValue}>{kpis.buyCount}</span>
                        </div>
                        <div className={styles.kpiChip}>
                            <span className={styles.kpiLabel}>Оборот</span>
                            <span className={styles.kpiValue}>{formatNumber(kpis.turnover)}</span>
                        </div>
                        <div className={styles.kpiChip}>
                            <span className={styles.kpiLabel}>Бюджет</span>
                            <span className={styles.kpiValue}>{formatNumber(kpis.budget)}</span>
                        </div>
                        {kpis.avgVs !== null && (
                            <div className={styles.kpiChip}>
                                <span className={styles.kpiLabel}>Ср. vs рынок</span>
                                <span className={`${styles.kpiValue} ${kpis.avgVs > 0 ? styles.negative : styles.positive}`}>
                                    {kpis.avgVs > 0 ? '+' : ''}{kpis.avgVs.toFixed(1)}%
                                </span>
                            </div>
                        )}
                    </div>

                    {shop.data && (
                        <div className={styles.sideInfo}>
                            <div className={styles.sideInfoRow}>
                                <span className={styles.sideInfoLabel}>Создан</span>
                                <span className={styles.sideInfoValue}>{formatDate(shop.data.createTime)}</span>
                            </div>
                            <div className={styles.sideInfoRow}>
                                <span className={styles.sideInfoLabel}>Замечен</span>
                                <span className={styles.sideInfoValue}>{formatDate(shop.data.firstSeenAt)}</span>
                            </div>
                            <div className={styles.sideInfoRow}>
                                <span className={styles.sideInfoLabel}>Активность</span>
                                <span className={styles.sideInfoValue}>{formatDate(shop.data.lastSeenAt)}</span>
                            </div>
                        </div>
                    )}

                    {/* Bot score compact */}
                    {botScore.data && (
                        <div className={styles.sideBotSection}>
                            <div className={styles.sideSectionLabel}>🤖 Бот-скор</div>
                            <div className={styles.botScoreBar}>
                                <div className={styles.botScoreTrack}>
                                    <div
                                        className={styles.botScoreFill}
                                        style={{width: `${botScorePercent}%`, background: botScoreColor}}
                                    />
                                </div>
                                <div className={styles.botScoreLabel}>
                                    {botScorePercent}% · {botScore.data.totalEvents} событий
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Related links */}
                    <div className={styles.sideLinks}>
                        <div className={styles.sideSectionLabel}>Связанные</div>
                        <Link to={`/players/${server}/${pid}`} className={styles.sideLink}>
                            → Профиль игрока
                        </Link>
                        <Link to="/shops" className={styles.sideLink}>
                            ← К списку магазинов
                        </Link>
                    </div>
                </aside>

                {/* ===== CONTENT ===== */}
                <div className={styles.content}>
                    {/* Toolbar */}
                    <div className={styles.toolbar}>
                        <ClearableInput
                            type="text"
                            className={styles.searchInput}
                            placeholder="Поиск по названию предмета…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClear={() => setSearch('')}
                        />
                        <div className={styles.filterGroup}>
                            {([
                                ['default', 'По умолч.'],
                                ['priceAsc', 'Цена ↑'],
                                ['priceDesc', 'Цена ↓'],
                                ['countDesc', 'Кол-во ↓'],
                                ['vsMarket', 'vs рынок'],
                            ] as Array<[SortKey, string]>).map(([k, label]) => (
                                <button
                                    key={k}
                                    className={`${styles.filterBtn} ${sortKey === k ? styles.filterBtnActive : ''}`}
                                    onClick={() => setSortKey(k)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className={styles.filterGroup}>
                            <button
                                className={`${styles.filterBtn} ${viewMode === 'grid' ? styles.filterBtnActive : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Плиткой"
                            >
                                ▦
                            </button>
                            <button
                                className={`${styles.filterBtn} ${viewMode === 'table' ? styles.filterBtnActive : ''}`}
                                onClick={() => setViewMode('table')}
                                title="Таблицей"
                            >
                                ☰
                            </button>
                        </div>
                    </div>

                    {/* Sell showcase */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <span className={styles.dotSell}/> Продажа ({sellItems.length})
                            </div>
                            {sectionAggregate(sellItems, true)}
                        </div>
                        {renderShowcase(sellItems, true)}
                    </div>

                    {/* Buy showcase */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <span className={styles.dotBuy}/> Скупка ({buyItems.length})
                            </div>
                            {sectionAggregate(buyItems, false)}
                        </div>
                        {renderShowcase(buyItems, false)}
                    </div>

                    {/* Bot events (expandable) */}
                    {botScore.data && botScore.data.events.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>События бот-детекции
                                    ({botScore.data.events.length})</div>
                                <button className={styles.expandBtn} onClick={() => setShowBotEvents(!showBotEvents)}>
                                    {showBotEvents ? 'Скрыть' : 'Показать'}
                                </button>
                            </div>

                            {showBotEvents && (
                                <table className={styles.table}>
                                    <thead>
                                    <tr>
                                        <th>Предмет</th>
                                        <th>Тип</th>
                                        <th>Старая цена</th>
                                        <th>Новая цена</th>
                                        <th>Цена конкурента</th>
                                        <th>Реакция</th>
                                        <th>Дата</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {botScore.data.events.slice(0, 50).map((e, i) => (
                                        <tr key={i}>
                                            <td>
                                                <Link to={`/items/${e.itemId}`} className={styles.itemNameCell}>
                                                    <img src={e.item?.icon ?? ''} alt="" className={styles.itemIcon}/>
                                                    {e.item?.name ?? `#${e.itemId}`}
                                                </Link>
                                            </td>
                                            <td className={e.isSell ? styles.sell : styles.buy}>
                                                {e.isSell ? 'Продажа' : 'Скупка'}
                                            </td>
                                            <td>{formatNumber(e.oldPrice)}</td>
                                            <td>{formatNumber(e.newPrice)}</td>
                                            <td>{formatNumber(e.competitorPrice)}</td>
                                            <td>{formatSeconds(e.reactionSeconds)}</td>
                                            <td>{formatDate(e.detectedAt)}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
