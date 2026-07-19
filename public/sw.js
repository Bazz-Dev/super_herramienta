// INGEGAR One — Service Worker
// Cache name synced from package.json's version by scripts/sync-sw-version.mjs
// on every build — bumping the version now auto-clears old PWA caches on deploy.
const CACHE = 'ingegar-one-1.11.0'
const OFFLINE_URL = '/offline'

// Assets to pre-cache for offline shell
const PRECACHE = [
  '/',
  '/dashboard',
  '/offline',
  '/ingegar-icon/192',
  '/ingegar-icon/512',
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
  // Only cache http/https — extensions and other schemes crash the Cache API
  if (!url.protocol.startsWith('http')) return
  // Skip API and auth routes — always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/login')) return

  // Navegaciones con redirect:'manual' — si fetch() sigue un redirect (ej. sesión
  // vencida → /login) de forma transparente y se entrega vía respondWith(), Chromium
  // a veces desincroniza la barra de direcciones del contenido real (queda en la URL
  // vieja aunque el body sea el de destino). 'manual' entrega un opaqueredirect que
  // el navegador resuelve nativamente, evitando el desincronismo (causa raíz G33).
  const isNavigation = event.request.mode === 'navigate'

  event.respondWith(
    fetch(event.request, isNavigation ? { redirect: 'manual' } : {})
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
  let data = { title: 'INGEGAR', body: 'Nueva notificación', icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', href: '/dashboard', tag: 'default' }
  if (event.data) {
    try { data = { ...data, ...event.data.json() } } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: { href: data.href },
      vibrate: [100, 50, 100],
      requireInteraction: false,
      tag: data.tag ?? data.href,
      // Silent on iOS (vibrate is desktop-only) — iOS shows notification natively
      silent: false,
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
