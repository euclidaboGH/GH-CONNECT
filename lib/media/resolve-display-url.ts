/**
 * Resolve private GreenHaven media facade URLs to short-lived displayable
 * Supabase signed URLs. Browser <img>/<video> cannot always follow
 * /api/media/:id/content redirects with session cookies (Pi Browser, mixed
 * absolute origins, cache). Fetch signed-url with credentials instead.
 */

const SIGNED_CACHE = new Map<string, { url: string; expiresAt: number }>()
const INFLIGHT = new Map<string, Promise<string | null>>()
let activeViewerScope = "anonymous"
let viewerEpoch = 0

/**
 * Bind the in-memory signed-URL cache to the active GreenHaven identity.
 * Signed URLs are bearer credentials, so they must never be reused from one
 * account session in another account session on the same device.
 */
export function setDisplayMediaViewer(userId: string, authState: string) {
  const nextScope = `${String(userId || "anonymous").trim() || "anonymous"}:${String(authState || "unknown")}`
  if (nextScope === activeViewerScope) return
  activeViewerScope = nextScope
  viewerEpoch += 1
  SIGNED_CACHE.clear()
  INFLIGHT.clear()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ghc:media-session-change", { detail: { epoch: viewerEpoch } }))
  }
}

/** Extract media id from /api/media/{id}/content (relative or absolute). */
export function extractMediaFacadeId(src: string): string | null {
  const s = String(src || "").trim()
  if (!s) return null
  try {
    const path = s.startsWith("http://") || s.startsWith("https://")
      ? new URL(s).pathname
      : s.startsWith("/")
        ? s
        : ""
    // Accept media_* and other opaque ids used by older uploads
    const m = path.match(/^\/api\/media\/([A-Za-z0-9_-]+)\/content\/?$/i)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

export function isMediaFacadeUrl(src: unknown): boolean {
  return typeof src === "string" && Boolean(extractMediaFacadeId(src))
}

/** Normalize upload responses to a stable same-origin relative facade path. */
export function toRelativeMediaFacadeUrl(url: string): string {
  const id = extractMediaFacadeId(url)
  if (id) return `/api/media/${id}/content`
  const u = String(url || "").trim()
  if (u.startsWith("/") && !u.startsWith("//")) return u
  return u
}

/**
 * Resolve a display src for <img>/<video>.
 * - Non-facade http(s)/data/relative: returned as-is
 * - Facade /api/media/:id/content: fetches signed URL with credentials
 */
export async function resolveDisplayMediaUrl(src: string | null | undefined): Promise<string | null> {
  const raw = typeof src === "string" ? src.trim() : ""
  if (!raw) return null

  const mediaId = extractMediaFacadeId(raw)
  if (!mediaId) {
    if (raw.startsWith("blob:") || raw.startsWith("data:") || raw.startsWith("http") || raw.startsWith("/")) {
      return raw
    }
    return null
  }

  const requestEpoch = viewerEpoch
  const cacheKey = `${requestEpoch}:${mediaId}`
  const now = Date.now()
  const cached = SIGNED_CACHE.get(cacheKey)
  if (cached && cached.expiresAt > now + 15_000) {
    return cached.url
  }

  const existing = INFLIGHT.get(cacheKey)
  if (existing) return existing

  const job = (async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}/signed-url`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        url?: string
        expiresIn?: number
      } | null
      // The account may have changed while this request was in flight.
      if (requestEpoch !== viewerEpoch) return null
      if (!res.ok || !data?.ok || typeof data.url !== "string" || !data.url.startsWith("https://")) {
        // CONTENT_FACADE_FALLBACK — same-origin content route may still stream for authorized sessions
        return `/api/media/${encodeURIComponent(mediaId)}/content`
      }
      const ttlMs = Math.max(30_000, Math.min(280_000, (Number(data.expiresIn) || 300) * 1000 - 20_000))
      SIGNED_CACHE.set(cacheKey, { url: data.url, expiresAt: Date.now() + ttlMs })
      return data.url
    } catch {
      return null
    } finally {
      INFLIGHT.delete(cacheKey)
    }
  })()

  INFLIGHT.set(cacheKey, job)
  return job
}

export function clearDisplayMediaCache(mediaId?: string) {
  if (mediaId) {
    for (const key of SIGNED_CACHE.keys()) if (key.endsWith(`:${mediaId}`)) SIGNED_CACHE.delete(key)
    for (const key of INFLIGHT.keys()) if (key.endsWith(`:${mediaId}`)) INFLIGHT.delete(key)
  } else {
    SIGNED_CACHE.clear()
    INFLIGHT.clear()
  }
}

/** Backwards-compatible name used by community cover rendering. */
export async function resolveDisplayUrl(src: string | null | undefined): Promise<string | null> {
  return resolveDisplayMediaUrl(src)
}
