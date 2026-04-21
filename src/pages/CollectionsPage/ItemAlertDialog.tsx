/**
 * Диалог настройки алерта по таргет-цене для предмета в подборке.
 *
 * Что делает:
 *  • показывает текущие серверные алерты по этому предмету+серверу и даёт их удалить;
 *  • создаёт новый алерт (price / direction / side / cooldown);
 *  • параллельно обновляет локальные `targetPrice` / `targetSide` в подборке —
 *    чтобы индикатор «🎯/🔔» работал сразу, до первого тика воркера;
 *  • включает push-подписку по кнопке и отправляет тестовое уведомление.
 *
 * Состояние подписки и список алертов пользователя перезагружаются при открытии.
 */

import { useEffect, useMemo, useState } from 'react'
import type { PShopServer } from '@/shared/api/pshop'
import {
  createAlert,
  deleteAlert,
  listAlerts,
  sendTestPush,
  type AlertDTO,
  type AlertDirection,
  type AlertSide,
} from '@/shared/api/pushAlerts'
import type { CollectionItem } from '@/shared/collections'
import { usePushSubscription } from './hooks/usePushSubscription'
import styles from './CollectionsPage.module.scss'

export interface ItemAlertDialogProps {
  open: boolean
  server: PShopServer
  entry: CollectionItem | null
  itemName?: string
  onClose: () => void
  onUpdateLocal: (patch: { targetPrice?: number; targetSide?: AlertSide }) => void
}

export function ItemAlertDialog({
  open,
  server,
  entry,
  itemName,
  onClose,
  onUpdateLocal,
}: ItemAlertDialogProps) {
  const push = usePushSubscription()

  const [price, setPrice] = useState('')
  const [side, setSide] = useState<AlertSide>('sell')
  const [direction, setDirection] = useState<AlertDirection>('<=')
  const [cooldownMin, setCooldownMin] = useState(30)
  const [alerts, setAlerts] = useState<AlertDTO[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Инициализация полей из текущей записи подборки
  useEffect(() => {
    if (!open || !entry) return
    setPrice(entry.targetPrice != null ? String(entry.targetPrice) : '')
    setSide(entry.targetSide ?? 'sell')
    setDirection('<=')
    setError(null)
    setNotice(null)
  }, [open, entry])

  // Подгружаем список алертов пользователя
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const { items } = await listAlerts()
        if (!cancelled) setAlerts(items)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const myAlerts = useMemo(() => {
    if (!entry) return []
    return alerts.filter((a) => a.itemId === entry.itemId && a.server === server)
  }, [alerts, entry, server])

  if (!open || !entry) return null

  const handleCreate = async () => {
    const num = Number(price)
    if (!Number.isFinite(num) || num <= 0) {
      setError('Введите корректную таргет-цену')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const created = await createAlert({
        itemId: entry.itemId,
        server,
        side,
        targetPrice: num,
        direction,
        cooldownMin,
      })
      setAlerts((prev) => [created, ...prev])
      onUpdateLocal({ targetPrice: num, targetSide: side })
      setNotice('Алерт сохранён')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await deleteAlert(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
      // Если это был последний — снимем локальный таргет.
      const remaining = alerts.filter(
        (a) => a.id !== id && a.itemId === entry.itemId && a.server === server,
      )
      if (remaining.length === 0) onUpdateLocal({ targetPrice: undefined, targetSide: undefined })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const r = await sendTestPush()
      setNotice(`Отправлено: ${r.sent}, удалено мёртвых подписок: ${r.removed}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3>🔔 Алерт: {itemName ?? `#${entry.itemId}`}</h3>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.alertSection}>
            <div className={styles.alertRow}>
              <label>
                Цена
                <input
                  className={styles.modalInput}
                  type="number"
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="например, 13000000"
                />
              </label>
              <label>
                Сторона
                <select
                  className={styles.modalInput}
                  value={side}
                  onChange={(e) => setSide(e.target.value as AlertSide)}
                >
                  <option value="sell">Продажа (min)</option>
                  <option value="buy">Скупка (max)</option>
                </select>
              </label>
              <label>
                Условие
                <select
                  className={styles.modalInput}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as AlertDirection)}
                >
                  <option value="<=">цена ≤ таргет</option>
                  <option value=">=">цена ≥ таргет</option>
                </select>
              </label>
              <label>
                Cooldown, мин
                <input
                  className={styles.modalInput}
                  type="number"
                  min={1}
                  max={1440}
                  value={cooldownMin}
                  onChange={(e) => setCooldownMin(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
            <div className={styles.alertHint}>
              Сервер: <strong>{server}</strong>. Алерт сработает когда достигнут таргет
              и cooldown истёк.
            </div>
          </div>

          <div className={styles.alertSection}>
            <h4 className={styles.alertSubtitle}>Активные алерты</h4>
            {myAlerts.length === 0 ? (
              <div className={styles.alertEmpty}>Нет алертов для этого предмета на «{server}».</div>
            ) : (
              <ul className={styles.alertList}>
                {myAlerts.map((a) => (
                  <li key={a.id} className={styles.alertItem}>
                    <span>
                      {a.side === 'sell' ? 'Продажа' : 'Скупка'} {a.direction}{' '}
                      <strong>{a.targetPrice.toLocaleString('ru-RU')}</strong> ·
                      cd {a.cooldownMin}м
                      {a.lastFiredAt && (
                        <span className={styles.alertFired}>
                          {' '}· сработал {new Date(a.lastFiredAt).toLocaleString('ru-RU')}
                        </span>
                      )}
                    </span>
                    <button
                      className={styles.btnDanger}
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(a.id)}
                    >
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.alertSection}>
            <h4 className={styles.alertSubtitle}>Push-уведомления</h4>
            {push.state === 'unsupported' ? (
              <div className={styles.alertEmpty}>
                Ваш браузер не поддерживает Web Push. На iOS установите приложение на домашний экран (iOS 16.4+).
              </div>
            ) : (
              <div className={styles.alertRow}>
                {push.subscribed ? (
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={push.busy}
                    onClick={() => void push.disable()}
                  >
                    Отключить push
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={push.busy}
                    onClick={() => void push.enable()}
                  >
                    Включить push
                  </button>
                )}
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy || !push.subscribed}
                  onClick={handleTest}
                  title={!push.subscribed ? 'Сначала включите push' : 'Отправить тестовое уведомление'}
                >
                  Тест
                </button>
                <span className={styles.alertHint}>
                  Разрешение: <strong>{push.state}</strong>
                  {push.subscribed && ' · подписка активна'}
                </span>
              </div>
            )}
            {push.error && <div className={styles.alertError}>{push.error}</div>}
          </div>

          {error && <div className={styles.alertError}>{error}</div>}
          {notice && <div className={styles.alertNotice}>{notice}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} type="button" onClick={onClose}>
            Закрыть
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="button"
            disabled={busy}
            onClick={handleCreate}
          >
            Сохранить алерт
          </button>
        </div>
      </div>
    </div>
  )
}
