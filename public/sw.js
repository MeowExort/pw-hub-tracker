/**
 * PW Hub Tracker — Service Worker для Web Push.
 *
 * Отвечает только за приём push и открытие соответствующей страницы по клику.
 * Кэширование/оффлайн-поведение сознательно не реализуется — это отдельная задача.
 */

self.addEventListener('install', (event) => {
  // Активируемся сразу, без ожидания закрытия старых вкладок.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'PW Hub', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'PW Hub'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-64x64.png',
    tag: data.itemId
      ? `alert-${data.itemId}-${data.server || 'x'}`
      : `pw-hub-${Date.now()}`,
    data: {
      url: data.url || '/collections',
      itemId: data.itemId,
      server: data.server,
      alertId: data.alertId,
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'mute', title: 'Закрыть' },
    ],
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))

  // Продублируем в открытые вкладки — на случай, если пользователь сейчас
  // в приложении и хочет видеть звук/тост без системной нотификации.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        try {
          c.postMessage({ type: 'pw-hub-alert', payload: data })
        } catch {
          /* noop */
        }
      }
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'mute') return

  const url = event.notification.data?.url || '/collections'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Если приложение уже открыто — фокусируем и переходим внутрь SPA.
      for (const c of list) {
        if ('focus' in c) {
          c.focus()
          try {
            c.postMessage({ type: 'pw-hub-alert-click', url })
          } catch {
            /* noop */
          }
          return
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
