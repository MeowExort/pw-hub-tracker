/**
 * Фоновый воркер алертов.
 *
 * Раз в `POLL_INTERVAL_MS` (по умолчанию 60с) собирает все активные алерты,
 * группирует их по server, батчами опрашивает реальный pshop через тот же
 * `POST /api/pshop/v2/items/batch`, что используется на фронте для подборок,
 * и отправляет push тем пользователям, чьи таргеты достигнуты, учитывая cooldown.
 *
 * Воркер НЕ ходит через `/api/proxy` (внутренний HTTP-маршрут BFF), а обращается
 * напрямую к API_TARGET — никакой подписи/PoW на этом контуре не нужно.
 */

import {
  getActiveAlerts,
  inCooldown,
  markFired,
  priceMatches,
  deleteExpired,
} from './alerts.js'
import { notifyUser } from './push.js'

const POLL_INTERVAL_MS = Number(process.env.ALERTS_POLL_MS || 60_000)
const BATCH_CHUNK = 200

/**
 * Сгруппировать массив по ключу.
 * @template T
 * @param {T[]} arr
 * @param {(x: T) => string} keyFn
 * @returns {Map<string, T[]>}
 */
function groupBy(arr, keyFn) {
  const map = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    const list = map.get(k) ?? []
    list.push(x)
    map.set(k, list)
  }
  return map
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Запросить батч предметов у апстрима. Возвращает `items: { [id]: ItemCardDTO }`.
 * Сигнатура соответствует контракту `/api/pshop/v2/items/batch`.
 */
async function fetchItemsBatch(apiTarget, apiKey, server, ids) {
  if (!ids.length) return {}
  const all = {}
  for (const ch of chunk(ids, BATCH_CHUNK)) {
    const resp = await fetch(`${apiTarget}/api/pshop/v2/items/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        server,
        ids: ch,
        fields: ['meta', 'sell', 'buy'],
      }),
    })
    if (!resp.ok) {
      console.error('[alerts-worker] batch http', resp.status, await resp.text().catch(() => ''))
      continue
    }
    const data = await resp.json().catch(() => null)
    if (data?.items) Object.assign(all, data.items)
  }
  return all
}

/** Основной тик. Возвращает статистику для логов. */
async function tick({ apiTarget, apiKey }) {
  await deleteExpired()
  const alerts = await getActiveAlerts()
  if (alerts.length === 0) return { alerts: 0, fired: 0 }

  let fired = 0
  const byServer = groupBy(alerts, (a) => a.server)

  for (const [server, list] of byServer) {
    const ids = Array.from(new Set(list.map((a) => a.itemId)))
    let items
    try {
      items = await fetchItemsBatch(apiTarget, apiKey, server, ids)
    } catch (e) {
      console.error('[alerts-worker] fetch failed', server, e?.message || e)
      continue
    }

    for (const alert of list) {
      if (inCooldown(alert)) continue
      const dto = items[alert.itemId] || items[String(alert.itemId)]
      if (!dto) continue
      const price =
        alert.side === 'sell' ? dto.sell?.min ?? null : dto.buy?.max ?? null
      if (!priceMatches(alert, price)) continue

      const payload = {
        title: `${dto.meta?.name ?? `#${alert.itemId}`}: ${formatMoney(price)}`,
        body: `Сервер ${server} — таргет ${alert.direction} ${formatMoney(alert.targetPrice)} достигнут`,
        icon: dto.meta?.icon || '/icon-192x192.png',
        url: `/items/${alert.itemId}?server=${encodeURIComponent(server)}`,
        itemId: alert.itemId,
        server,
        alertId: alert.id,
        price,
      }

      try {
        await notifyUser(alert.userId, payload)
        await markFired(alert.id)
        fired++
      } catch (e) {
        console.error('[alerts-worker] notify failed', alert.id, e?.message || e)
      }
    }
  }

  return { alerts: alerts.length, fired }
}

function formatMoney(v) {
  if (typeof v !== 'number') return String(v)
  return v.toLocaleString('ru-RU')
}

/** Запустить воркер. Возвращает функцию остановки. */
export function startAlertsWorker({ apiTarget, apiKey }) {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      const stats = await tick({ apiTarget, apiKey })
      if (stats.alerts > 0) {
        console.log(`[alerts-worker] tick: alerts=${stats.alerts} fired=${stats.fired}`)
      }
    } catch (e) {
      console.error('[alerts-worker] tick error', e)
    } finally {
      running = false
    }
  }

  // Первый запуск — через 10с после старта сервера, чтобы не мешать холодному старту.
  const first = setTimeout(run, 10_000)
  const timer = setInterval(run, POLL_INTERVAL_MS)
  timer.unref?.()
  first.unref?.()
  console.log(`[alerts-worker] запущен, интервал ${POLL_INTERVAL_MS}ms, target=${apiTarget}`)
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}
