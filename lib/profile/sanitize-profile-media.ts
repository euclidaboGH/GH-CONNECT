/**
 * Phase 7 — keep profile media cross-device safe.
 * blob: and data: never survive logout / other devices.
 */
export function isCrossDeviceMediaUrl(url: unknown): boolean {
  const u = String(url || "").trim()
  if (!u) return false
  if (u.startsWith("blob:") || u.startsWith("data:")) return false
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
      .filter(isCrossDeviceMediaUrl)
      .slice(0, 6)
  }

  if ("coverPhoto" in next) {
    const c = next.coverPhoto
    if (c === null || c === "") {
      next.coverPhoto = c as null | ""
    } else if (!isCrossDeviceMediaUrl(c)) {
      delete next.coverPhoto
    }
  }

  return next as T
}
