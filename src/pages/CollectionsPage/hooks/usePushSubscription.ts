/**
 * Управление Web Push-подпиской: регистрация Service Worker, запрос Notification
 * permission, подписка через `PushManager` и регистрация её на BFF.
 *
 * Хук возвращает:
 *  • текущее состояние (`permission`, флаги готовности),
 *  • методы `enable()` / `disable()`,
 *  • `supported` — если браузер не умеет в push (iOS без PWA, старые WebKit и т. п.).
 *
 * Намеренно идемпотентный: повторный `enable()` не создаёт дубликатов подписок —
 * BFF дедуплицирует по `endpoint`.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
} from '@/shared/api/pushAlerts'

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

export interface UsePushSubscriptionApi {
  state: PushState
  subscribed: boolean
  busy: boolean
  error: string | null
  enable: () => Promise<boolean>
  disable: () => Promise<void>
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function usePushSubscription(): UsePushSubscriptionApi {
  const [state, setState] = useState<PushState>(() =>
    !isSupported() ? 'unsupported' : (Notification.permission as PushState),
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // При монтировании — проверим, есть ли уже подписка.
  useEffect(() => {
    if (!isSupported()) return
    let cancelled = false
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (!cancelled) setSubscribed(!!sub)
      } catch {
        /* noop */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isSupported()) {
      setError('Браузер не поддерживает Web Push')
      return false
    }
    setBusy(true)
    setError(null)
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration('/sw.js')) ??
        (await navigator.serviceWorker.register('/sw.js'))
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      setState(permission as PushState)
      if (permission !== 'granted') {
        setError(
          permission === 'denied'
            ? 'Разрешение на уведомления отклонено'
            : 'Разрешение не выдано',
        )
        return false
      }

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        const { key } = await getVapidPublicKey()
        if (!key) {
          setError('Сервер не сообщил VAPID-ключ')
          return false
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        })
      }

      await subscribePush(sub.toJSON())
      setSubscribed(true)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    if (!isSupported()) return
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        try {
          await unsubscribePush(sub.endpoint)
        } catch {
          /* BFF перезапущен — не блокируем отписку */
        }
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, subscribed, busy, error, enable, disable }
}
