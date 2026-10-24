/**
 * Resolve private GreenHaven media facade URLs to short-lived displayable
 * Supabase signed URLs. Browser <img>/<video> cannot always follow
 * /api/media/:id/content redirects with session cookies (Pi Browser, mixed
 * absolute origins, cache). Fetch signed-url with credentials instead.
 */

const SIGNED_CACHE = new Map<string, { url: string; expiresAt: number }>()
const INFLIGHT = new Map<string, Promise<string | null>>()

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
    const m = path.match(/^\/api\/media\/(media_[A-Za-z0-9_]+)\/content\/?$/i)
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

  const now = Date.now()
  const cached = SIGNED_CACHE.get(mediaId)
  if (cached && cached.expiresAt > now + 15_000) {
    return cached.url
  }

  const existing = INFLIGHT.get(mediaId)
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
      if (!res.ok || !data?.ok || typeof data.url !== "string" || !data.url.startsWith("https://")) {
        return null
      }
      const ttlMs = Math.max(30_000, Math.min(280_000, (Number(data.expiresIn) || 300) * 1000 - 20_000))
      SIGNED_CACHE.set(mediaId, { url: data.url, expiresAt: Date.now() + ttlMs })
      return data.url
    } catch {
      return null
    } finally {
      INFLIGHT.delete(mediaId)
    }
  })()

  INFLIGHT.set(mediaId, job)
  return job
}

export function clearDisplayMediaCache(mediaId?: string) {
  if (mediaId) SIGNED_CACHE.delete(mediaId)
  else SIGNED_CACHE.clear()
}
