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

export function sanitizeProfileMediaPartial<T extends Record<string, unknown>>(
  partial: T
): T {
  // Work through a string-keyed record so this sanitizer can safely handle
  // partial profile payloads whose generic type does not declare media fields.
  // The spread preserves all unrelated fields and the returned shape remains T.
  const next: Record<string, unknown> = { ...partial }

  if (Array.isArray(next.photos)) {
    next.photos = next.photos
      .map((value) => String(value))
      .filter(isCrossDeviceMediaUrl)
      .slice(0, 6)
  }

  if (Object.prototype.hasOwnProperty.call(next, "coverPhoto")) {
    const coverPhoto = next.coverPhoto
    if (coverPhoto === null || coverPhoto === "") {
      // Preserve intentional explicit clearing of the cover photo.
      next.coverPhoto = coverPhoto
    } else if (!isCrossDeviceMediaUrl(coverPhoto)) {
      // Omit invalid/local-only cover media instead of persisting it.
      delete next.coverPhoto
    }
  }

  return next as T
}
