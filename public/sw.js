const CACHE_NAME = 'gh-connect-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - Network-first strategy with fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip chrome extensions and non-http protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  // API requests: network-first
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            return new Response('Network error, and no cache available', {
              status: 503,
              statusText: 'Service Unavailable',
            })
          })
        })
    )
    return
  }

  // Static assets and pages: cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Background update
        fetch(request)
          .then((response) => {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          })
          .catch(() => {
            // Silently fail background update
          })
        return cachedResponse
      }

      return fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          return caches.match('/index.html')
        })
    })
  )
})

// Background sync for message delivery
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages())
  }
})

async function syncMessages() {
  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    const messageRequests = keys.filter((req) => req.url.includes('/api/messages'))

    for (const request of messageRequests) {
      try {
        await fetch(request)
        await cache.delete(request)
      } catch (err) {
        console.warn('[SW] Message sync failed:', err)
      }
    }
  } catch (err) {
    console.error('[SW] Background sync error:', err)
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'GreenHaven'
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-dark-32x32.png',
    badge: '/icon-light-32x32.png',
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})
