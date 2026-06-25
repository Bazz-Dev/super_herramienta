// INGEGAR Platform — Service Worker
const CACHE = 'ingegar-v1'
const OFFLINE_URL = '/offline'

// Assets to pre-cache for offline shell
const PRECACHE = [
  '/',
  '/dashboard',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first strategy: try network, fall back to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  // Skip API and auth routes — always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/login')) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(event.request, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? caches.match(OFFLINE_URL))
      )
  )
})

// Push notification received
self.addEventListener('push', (event) => {
  let data = { title: 'INGEGAR', body: 'Nueva notificación', icon: '/icons/icon-192.png', href: '/dashboard' }
  if (event.data) {
    try { data = { ...data, ...event.data.json() } } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icons/badge-72.png',
      data: { href: data.href },
      vibrate: [100, 50, 100],
      requireInteraction: false,
      tag: data.href, // group by destination — replaces older same-route notification
    })
  )
})

// Notification click — open or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href ?? '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const match = clients.find((c) => c.url.includes(self.location.origin))
      if (match) {
        match.focus()
        match.postMessage({ type: 'navigate', href })
      } else {
        self.clients.openWindow(self.location.origin + href)
      }
    })
  )
})
