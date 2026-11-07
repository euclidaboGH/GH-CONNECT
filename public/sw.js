/**
 * GreenHaven service worker — explicitly allowlisted public static assets only.
 *
 * SECURITY: Never cache navigation documents, authenticated pages, RSC payloads,
 * API responses, media facades, or user-specific data. Navigations and every
 * /api/ request remain network-only. Only immutable Next static chunks and a
 * short explicit list of public app assets may use Cache Storage.
 */
const CACHE_NAME = "gh-connect-v3-public-static"
const STATIC_ASSETS = [
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/icon-dark-32x32.png",
  "/icon-light-32x32.png",
  "/apple-icon.png",
  "/greenhaven-logo.png",
  "/greenhaven-lockup.png",
  "/greenhaven-mark.png",
  "/ghc-coin-32.png",
  "/ghc-coin-64.png",
  "/ghc-coin-logo.png",
  "/placeholder.svg",
]
const STATIC_PREFIXES = ["/_next/static/"]

function isApiRequest(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/") || pathname.includes("/api/")
}

function isPublicStaticRequest(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return false
  if (request.headers.has("authorization") || request.cache === "no-store") return false
  if (STATIC_ASSETS.includes(url.pathname)) return true
  return STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
}

function isSafePublicStaticResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false
  const cacheControl = response.headers.get("cache-control") || ""
  const vary = response.headers.get("vary") || ""
  if (/\b(private|no-store|no-cache)\b/i.test(cacheControl)) return false
  if (vary.trim() === "*") return false
  return true
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(STATIC_ASSETS.map(async (asset) => {
        try {
          const response = await fetch(asset, { credentials: "omit", cache: "reload" })
          if (isSafePublicStaticResponse(response)) await cache.put(asset, response)
        } catch {
          // Installation remains available even if an optional icon is unavailable.
        }
      }))
    })
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.filter((name) => name.startsWith("gh-connect-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    ))
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  let url
  try { url = new URL(request.url) } catch { return }
  if (url.protocol !== "http:" && url.protocol !== "https:") return

  // All APIs, including media and authenticated feeds: network-only, no cache fallback.
  if (url.origin === self.location.origin && isApiRequest(url.pathname)) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ ok: false, error: "NETWORK_UNAVAILABLE", message: "API requires a network connection" }),
      { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
    )))
    return
  }

  // Never intercept navigations/documents. This prevents account-specific HTML,
  // Next RSC payloads and app state from leaking across sessions or going stale.
  if (request.mode === "navigate" || request.destination === "document") return
  if (!isPublicStaticRequest(request, url)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      if (isSafePublicStaticResponse(response)) {
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      return new Response("Static asset unavailable offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      })
    }
  })())
})

self.addEventListener("push", (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
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
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow("/")
    })
  )
})
