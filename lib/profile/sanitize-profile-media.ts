/**
 * Keep profile media displayable on this device.
 * Prefer https/http for cross-device; allow compact data:image for local fallback
 * when durable storage is unavailable. Never keep blob: (session-only).
 */

const MAX_LOCAL_DATA_URL = 220_000

export function isCrossDeviceMediaUrl(url: unknown): boolean {
  const u = String(url || "").trim()
  if (!u) return false
  if (u.startsWith("blob:")) return false
  if (u.startsWith("https://") || u.startsWith("http://") || u.startsWith("/")) return true
  return false
}

/** Acceptable for in-app display (this device + durable). */
export function isDisplayableProfileMediaUrl(url: unknown): boolean {
  const u = String(url || "").trim()
  if (!u) return false
  if (u.startsWith("blob:")) return false
  if (u.startsWith("data:image/") && u.length <= MAX_LOCAL_DATA_URL) return true
  if (u.startsWith("https://") || u.startsWith("http://") || u.startsWith("/")) return true
  return false
}

type ProfileMediaFields = {
  photos?: unknown
  coverPhoto?: unknown
}

export function sanitizeProfileMediaPartial<T extends ProfileMediaFields>(
  partial: T
): T {
  const next: ProfileMediaFields & Record<string, unknown> = { ...partial }

  if (Array.isArray(next.photos)) {
    next.photos = (next.photos as unknown[])
      .map(String)
      .filter(isDisplayableProfileMediaUrl)
      .slice(0, 6)
  }

  if ("coverPhoto" in next) {
    const c = next.coverPhoto
    if (c === null || c === "") {
      next.coverPhoto = c as null | ""
    } else if (!isDisplayableProfileMediaUrl(c)) {
      delete next.coverPhoto
    }
  }

  return next as T
}

/** URLs safe to send to the profile API (no data:/blob: — server rejects those). */
export function durableOnlyProfileMedia(partial: {
  photos?: string[]
  coverPhoto?: string | null
}): { photos?: string[]; coverPhoto?: string | null } {
  const out: { photos?: string[]; coverPhoto?: string | null } = {}
  if (Array.isArray(partial.photos)) {
    out.photos = partial.photos.map(String).filter(isCrossDeviceMediaUrl).slice(0, 6)
  }
  if ("coverPhoto" in partial) {
    const c = partial.coverPhoto
    if (c === null || c === "") out.coverPhoto = c as null | ""
    else if (isCrossDeviceMediaUrl(c)) out.coverPhoto = String(c)
    // omit data: so server keeps existing durable cover
  }
  return out
}
