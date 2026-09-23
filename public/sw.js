/**
 * GreenHaven service worker — static assets only.
 *
 * SECURITY: Never cache authenticated / personalized API responses.
 * Paths under /api/ are network-only (no put, no match fallback of user data).
 */
const CACHE_NAME = "gh-connect-v2-static"
const STATIC_ASSETS = ["/", "/manifest.json"]

/** Path prefixes that must never be stored in Cache Storage */
const API_NO_CACHE_PREFIXES = [
  "/api/auth",
  "/api/profile",
  "/api/economy",
  "/api/membership",
  "/api/payments",
  "/api/messaging",
  "/api/messages",
  "/api/sessions",
  "/api/wallet",
  "/api/notifications",
  "/api/connections",
  "/api/verification",
  "/api/governance",
  "/api/marketplace",
  "/api/pi",
  "/api/",
]

function isApiRequest(pathname) {
  return pathname.includes("/api/")
}

function isPersonalizedApi(pathname) {
  return API_NO_CACHE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        /* ignore partial static precache failures */
      })
    })
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return
  }

  // All API traffic: network-only. Never write to cache. Never serve cached API bodies.
  if (isApiRequest(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "NETWORK_UNAVAILABLE",
            message: "API requires a network connection",
          }),
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "application/json" },
          }
        )
      })
    )
    return
  }

  // Non-API: cache-first for static shell only (no credentials-bearing API)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request)
          .then((response) => {
            if (response && response.ok && request.method === "GET") {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone)
              })
            }
          })
          .catch(() => {})
        return cachedResponse
      }

      return fetch(request)
        .then((response) => {
          if (response && response.ok && request.method === "GET" && !isPersonalizedApi(url.pathname)) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
        .catch(() => caches.match("/").then((r) => r || new Response("Offline", { status: 503 })))
    })
  )
})

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || "GreenHaven"
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icon-dark-32x32.png",
    badge: "/icon-light-32x32.png",
    tag: data.tag || "notification",
    requireInteraction: data.requireInteraction || false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/")
      }
    })
  )
})
