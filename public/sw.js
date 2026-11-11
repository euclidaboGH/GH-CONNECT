/**
 * GreenHaven service worker — explicitly allowlisted public static assets only.
 *
 * SECURITY: Never cache navigation documents, authenticated pages, RSC payloads,
 * API responses, media facades, or user-specific data. Navigations and every
 * /api/ request remain network-only. Only immutable Next static chunks and a
 * short explicit list of public app assets may use Cache Storage.
 */
const CACHE_NAME = "greenhaven-v4-public-static"
const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/icon-dark-32x32.png",
  "/icon-light-32x32.png",
  "/apple-icon.png",
  "/greenhaven-logo.png",
  "/greenhaven-logo-dark.png",
  "/greenhaven-lockup.png",
  "/greenhaven-lockup-dark.png",
  "/greenhaven-mark.png",
  "/greenhaven-mark-dark.png",
  "/gh-connect-logo.png",
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

// Receiver only: authenticated subscription APIs exist, but no provider sender is
// enabled yet. Push content is generic; private details are fetched after app open.
self.addEventListener("push", (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  // Remote payloads are intentionally generic: private message, wallet, payment,
  // reward and membership details must be fetched only after authenticated app open.
  const title = "GreenHaven"
  const options = {
    body: "You have a new notification",
    icon: "/icon-dark-32x32.png",
    badge: "/icon-light-32x32.png",
    tag: typeof data.tag === "string" && /^ghn:[a-f0-9]{32}$/.test(data.tag) ? data.tag : "greenhaven-notification",
    requireInteraction: data.requireInteraction === true,
    data: { url: "/" },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  let target = "/"
  try {
    const clickData = event.notification.data || {}
    const candidate = new URL(clickData.url || clickData.deepLink || clickData.actionUrl || "/", self.location.origin)
    if (candidate.origin === self.location.origin && candidate.protocol === self.location.protocol) {
      target = `${candidate.pathname}${candidate.search}${candidate.hash}`
    }
  } catch { /* retain safe root destination */ }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          if ("navigate" in client) return client.navigate(target).then(() => client.focus())
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(target)
    })
  )
})
