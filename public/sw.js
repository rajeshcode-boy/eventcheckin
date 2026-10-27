// Service Worker for PWA caching. Only public static files are cached.
// Pages and API data are never cached: they can hold one organiser's data, and the cache survives logout.
const CACHE_NAME = 'eventcheckin-v2'
const urlsToCache = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error:', err)
      })
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Web push: show the notification the server sent (iOS requires showing one for every push)
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'EventCheckin', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    })
  )
})

// Tapping a notification focuses the open app window, or opens the page it links to
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url === target)
      if (open) return open.focus()
      return self.clients.openWindow(target)
    })
  )
})

const STATIC_PATHS = ['/_next/static/', '/icons/']

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Other origins (Supabase, Vercel analytics) and API routes go straight to the network, never cached
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Pages always come from the network, so signed-in data is never served from a cache
  if (request.mode === 'navigate') return

  if (!STATIC_PATHS.some((p) => url.pathname.startsWith(p))) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
