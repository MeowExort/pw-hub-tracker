/**
 * Страница `/alerts` — список таргет-алертов пользователя.
 *
 * Что показывает:
 *  • блок состояния Web Push (разрешение, подписка, кнопки enable/disable/test);
 *  • список алертов, СГРУППИРОВАННЫЙ по предмету: шапка группы — иконка/имя/тултип,
 *    внутри — компактные строки условий (сервер · сторона · направление · таргет ·
 *    cooldown · статус · последнее срабатывание · меню действий);
 *  • кнопку ручного обновления списка.
 *
 * Данные читаются из BFF `/api/alerts` (in-memory хранилище шага 4),
 * идентификация — через `X-User-Id` (см. `pushAlerts.ts`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteAlert,
  listAlerts,
  sendTestPush,
  type AlertDTO,
} from '@/shared/api/pushAlerts'
import { usePushSubscription } from '@/pages/CollectionsPage/hooks/usePushSubscription'
import {
  useCollectionItems,
  type CollectionItemData,
} from '@/pages/CollectionsPage/hooks/useCollectionItems'
import { ItemTooltip } from '@/shared/ui/ItemTooltip'
import { formatNumber } from '@/shared/utils/pshop'
import type { PShopServer } from '@/shared/api/pshop'
import styles from './AlertsPage.module.scss'

const SERVER_LABELS: Record<PShopServer, string> = {
  capella: 'Capella',
  centaur: 'Centaur',
  alkor: 'Alkor',
  mizar: 'Mizar',
}


type AlertStatus = 'active' | 'cooldown' | 'fired' | 'expired'

interface AlertRow extends AlertDTO {
  status: AlertStatus
  cooldownLeftMs: number
}

interface AlertGroup {
  itemId: number
  /** Сервер, по которому удалось подгрузить мету (первый из найденных). */
  metaServer: PShopServer | null
  details: CollectionItemData | null | undefined
  isLoading: boolean
  rows: AlertRow[]
}

function computeStatus(a: AlertDTO, now: number): { status: AlertStatus; cooldownLeftMs: number } {
  if (a.expiresAt && a.expiresAt < now) return { status: 'expired', cooldownLeftMs: 0 }
  if (a.lastFiredAt) {
    const cdEnd = a.lastFiredAt + a.cooldownMin * 60_000
    if (cdEnd > now) return { status: 'cooldown', cooldownLeftMs: cdEnd - now }
    return { status: 'fired', cooldownLeftMs: 0 }
  }
  return { status: 'active', cooldownLeftMs: 0 }
}

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s} с назад`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return new Date(ts).toLocaleString()
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m === 0) return `${rs} с`
  return `${m} мин ${rs.toString().padStart(2, '0')} с`
}

/**
 * Загружает мету предметов сразу по всем серверам, на которых есть алерты.
 * Хук-обёртка над `useCollectionItems`: вызывается фиксированное число раз
 * (по числу серверов), что не нарушает правила React о порядке хуков.
 */
function useAlertsItemsByServer(alerts: readonly AlertDTO[]) {
  const idsByServer = useMemo(() => {
    const map: Record<PShopServer, number[]> = {
      capella: [],
      centaur: [],
      alkor: [],
      mizar: [],
    }
    const seen: Record<PShopServer, Set<number>> = {
      capella: new Set(),
      centaur: new Set(),
      alkor: new Set(),
      mizar: new Set(),
    }
    for (const a of alerts) {
      const s = a.server as PShopServer
      if (!seen[s]) continue
      if (seen[s].has(a.itemId)) continue
      seen[s].add(a.itemId)
      map[s].push(a.itemId)
    }
    return map
  }, [alerts])

  const capella = useCollectionItems(idsByServer.capella, 'capella')
  const centaur = useCollectionItems(idsByServer.centaur, 'centaur')
  const alkor = useCollectionItems(idsByServer.alkor, 'alkor')
  const mizar = useCollectionItems(idsByServer.mizar, 'mizar')

  return useMemo(() => {
    const map: Record<PShopServer, { data: ReturnType<typeof useCollectionItems>['data']; isLoading: boolean }> = {
      capella: { data: capella.data, isLoading: capella.isLoading },
      centaur: { data: centaur.data, isLoading: centaur.isLoading },
      alkor: { data: alkor.data, isLoading: alkor.isLoading },
      mizar: { data: mizar.data, isLoading: mizar.isLoading },
    }
    return map
  }, [capella.data, capella.isLoading, centaur.data, centaur.isLoading, alkor.data, alkor.isLoading, mizar.data, mizar.isLoading])
}

export function AlertsPage() {
  const push = usePushSubscription()

  const [alerts, setAlerts] = useState<AlertDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyTest, setBusyTest] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Тикер для живых cooldown'ов и «N сек назад».
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { items } = await listAlerts()
      setAlerts(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const itemsByServer = useAlertsItemsByServer(alerts)

  const groups = useMemo<AlertGroup[]>(() => {
    const rows: AlertRow[] = alerts.map((a) => ({ ...a, ...computeStatus(a, now) }))

    // Группировка по itemId; внутри сортируем по createdAt (свежие первыми).
    const byItem = new Map<number, AlertRow[]>()
    for (const r of rows) {
      const arr = byItem.get(r.itemId)
      if (arr) arr.push(r)
      else byItem.set(r.itemId, [r])
    }

    const result: AlertGroup[] = []
    for (const [itemId, list] of byItem) {
      list.sort((a, b) => b.createdAt - a.createdAt)

      // Ищем мету предмета на любом из серверов, где есть алерт по нему.
      const serversForItem = Array.from(new Set(list.map((r) => r.server as PShopServer)))
      let details: CollectionItemData | null | undefined
      let metaServer: PShopServer | null = null
      let isLoading = false
      for (const s of serversForItem) {
        const bucket = itemsByServer[s]
        if (!bucket) continue
        const found = bucket.data?.items[itemId]
        if (found) {
          details = found
          metaServer = s
          break
        }
        if (bucket.isLoading) isLoading = true
      }

      result.push({
        itemId,
        metaServer,
        details,
        isLoading: !details && isLoading,
        rows: list,
      })
    }

    // Сортируем группы: сперва те, где есть «горящие» (fired/active), затем по дате
    // последнего изменения внутри группы.
    result.sort((a, b) => {
      const aTs = Math.max(...a.rows.map((r) => r.lastFiredAt ?? r.createdAt))
      const bTs = Math.max(...b.rows.map((r) => r.lastFiredAt ?? r.createdAt))
      return bTs - aTs
    })

    return result
  }, [alerts, now, itemsByServer])

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот алерт?')) return
    const prev = alerts
    setAlerts((list) => list.filter((a) => a.id !== id))
    try {
      await deleteAlert(id)
    } catch (e) {
      setAlerts(prev)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleTest = async () => {
    setBusyTest(true)
    setError(null)
    setNotice(null)
    try {
      const { sent, removed } = await sendTestPush()
      if (sent > 0) setNotice(`Тестовое уведомление отправлено (подписок: ${sent})`)
      else if (removed > 0) setNotice(`Активных подписок нет — очищено мёртвых: ${removed}`)
      else setNotice('Нет активных push-подписок. Включите уведомления.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyTest(false)
    }
  }

  const permissionBadgeCls =
    push.state === 'granted'
      ? `${styles.permissionBadge} ${styles.granted}`
      : push.state === 'denied'
        ? `${styles.permissionBadge} ${styles.denied}`
        : styles.permissionBadge

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Алерты</h1>
          <p className={styles.subtitle}>
            Уведомления о достижении таргет-цены по предметам из ваших подборок.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Обновление…' : '↻ Обновить'}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void handleTest()}
            disabled={busyTest}
          >
            {busyTest ? 'Отправка…' : 'Отправить тестовое push'}
          </button>
        </div>
      </div>

      <div className={styles.permission}>
        <span className={permissionBadgeCls}>
          {push.state === 'unsupported' && 'не поддерживается'}
          {push.state === 'default' && 'не запрошено'}
          {push.state === 'granted' && (push.subscribed ? 'подписан' : 'разрешено')}
          {push.state === 'denied' && 'отклонено'}
        </span>
        <div className={styles.permissionText}>
          {push.state === 'unsupported' &&
            'Ваш браузер не поддерживает Web Push. На iOS добавьте приложение на домашний экран (PWA) и повторите.'}
          {push.state === 'default' &&
            'Чтобы получать уведомления о таргет-ценах — включите push в этом браузере.'}
          {push.state === 'granted' &&
            (push.subscribed
              ? 'Push-подписка активна. Вы будете получать уведомления при достижении таргет-цены.'
              : 'Разрешение получено, но подписки ещё нет — нажмите «Включить push».')}
          {push.state === 'denied' &&
            'Уведомления для этого сайта заблокированы в настройках браузера. Снимите блокировку и повторите.'}
        </div>
        {push.state !== 'unsupported' && (
          push.subscribed ? (
            <button
              type="button"
              className={styles.btn}
              onClick={() => void push.disable()}
              disabled={push.busy}
            >
              {push.busy ? '…' : 'Отключить push'}
            </button>
          ) : (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void push.enable()}
              disabled={push.busy || push.state === 'denied'}
            >
              {push.busy ? '…' : 'Включить push'}
            </button>
          )
        )}
      </div>

      {push.error && <div className={styles.error}>{push.error}</div>}
      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {loading && alerts.length === 0 ? (
        <div className={styles.loading}>Загрузка алертов…</div>
      ) : groups.length === 0 ? (
        <div className={styles.empty}>
          Алертов пока нет. Откройте любую подборку и нажмите «🔔» у предмета, чтобы настроить таргет.
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map((g) => (
            <AlertGroupCard
              key={g.itemId}
              group={g}
              now={now}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AlertGroupCardProps {
  group: AlertGroup
  now: number
  onDelete: (id: string) => void
}

function AlertGroupCard({ group, now, onDelete }: AlertGroupCardProps) {
  const { itemId, details, isLoading, rows, metaServer } = group
  const info = details?.info

  // Акцентная рамка по «худшему/важнейшему» статусу группы.
  const accent = pickAccent(rows)

  return (
    <div className={styles.group} data-accent={accent}>
      <div className={styles.groupHead}>
        {info ? (
          <ItemTooltip
            itemId={info.itemId}
            server={metaServer ?? undefined}
            name={info.name}
            icon={info.icon ?? ''}
            nameColor={info.nameColor}
          >
            <Link to={`/items/${info.itemId}`} className={styles.groupLink}>
              {info.icon && <img src={info.icon} alt="" className={styles.groupIcon} />}
              <span
                className={styles.groupName}
                style={info.nameColor ? { color: `#${info.nameColor}` } : undefined}
              >
                {info.name}
              </span>
            </Link>
          </ItemTooltip>
        ) : (
          <Link to={`/items/${itemId}`} className={styles.groupLink}>
            <span className={styles.groupName}>
              {isLoading ? 'Загрузка…' : `#${itemId}`}
            </span>
          </Link>
        )}
        <span className={styles.groupCount}>
          {rows.length} {pluralAlerts(rows.length)}
        </span>
      </div>

      <ul className={styles.alertList}>
        {rows.map((a) => (
          <li key={a.id} className={styles.alertRow} data-status={a.status}>
            <div className={styles.alertCondition}>
              <span className={styles.serverChip}>{SERVER_LABELS[a.server] ?? a.server}</span>
              <span className={a.side === 'sell' ? styles.sideSell : styles.sideBuy}>
                {a.side === 'sell' ? 'продажа' : 'скупка'}
              </span>
              <span className={styles.mono}>{a.direction}</span>
              <span className={styles.targetPrice}>{formatNumber(a.targetPrice)}</span>
            </div>

            <div className={styles.alertMeta}>
              {a.status === 'active' && <span className={styles.badgeActive}>активен</span>}
              {a.status === 'cooldown' && (
                <span className={styles.badgeCooldown} title="В периоде анти-спама">
                  КД  {formatDuration(a.cooldownLeftMs)}
                </span>
              )}
              {a.status === 'fired' && <span className={styles.badgeFired}>сработал</span>}
              {a.status === 'expired' && <span className={styles.badgeExpired}>истёк</span>}

              <span className={styles.metaDim}>КД  {a.cooldownMin} мин</span>

              {a.lastFiredAt ? (
                <span className={styles.metaDim} title={new Date(a.lastFiredAt).toLocaleString()}>
                  🔔 {formatRelative(a.lastFiredAt, now)}
                </span>
              ) : (
                <span className={styles.metaDim} title={new Date(a.createdAt).toLocaleString()}>
                  создан {formatRelative(a.createdAt, now)}
                </span>
              )}
            </div>

            <button
              type="button"
              className={styles.rowDelete}
              onClick={() => onDelete(a.id)}
              aria-label="Удалить алерт"
              title="Удалить алерт"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function pickAccent(rows: readonly AlertRow[]): AlertStatus {
  // Приоритет визуального акцента: fired > active > cooldown > expired.
  const order: AlertStatus[] = ['fired', 'active', 'cooldown', 'expired']
  for (const s of order) {
    if (rows.some((r) => r.status === s)) return s
  }
  return 'expired'
}

function pluralAlerts(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'алерт'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'алерта'
  return 'алертов'
}
