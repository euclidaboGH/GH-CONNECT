/**
 * Device-local profile media cache keyed by user id.
 * Survives logout/login on the same browser when server media lags.
 * Never invents photos — only stores what the user already saved.
 */

const PREFIX = "ghc.profile.media."

export type ProfileMediaCache = {
  userId: string
  photos: string[]
  coverPhoto: string | null
  updatedAt: number
}

function keyFor(userId: string): string {
  return PREFIX + String(userId || "").trim()
}

export function saveProfileMediaCache(input: {
  userId?: string | null
  photos?: string[] | null
  coverPhoto?: string | null
}): void {
  if (typeof window === "undefined") return
  const uid = String(input.userId || "").trim()
  if (!uid || uid === "current-user" || uid === "preview-user") return
  try {
    const photos = Array.isArray(input.photos)
      ? input.photos.filter((p) => typeof p === "string" && p.length > 0).slice(0, 6)
      : []
    const cover =
      typeof input.coverPhoto === "string" && input.coverPhoto.length > 0
        ? input.coverPhoto
        : null
    if (!photos.length && !cover) {
      // Keep previous cache rather than wiping with empty save from incomplete state
      return
    }
    const payload: ProfileMediaCache = {
      userId: uid,
      photos,
      coverPhoto: cover,
      updatedAt: Date.now(),
    }
    window.localStorage.setItem(keyFor(uid), JSON.stringify(payload))
  } catch {
    /* quota — ignore */
  }
}

export function loadProfileMediaCache(userId?: string | null): ProfileMediaCache | null {
  if (typeof window === "undefined") return null
  const uid = String(userId || "").trim()
  if (!uid) return null
  try {
    const raw = window.localStorage.getItem(keyFor(uid))
    if (!raw) return null
    const p = JSON.parse(raw) as ProfileMediaCache
    if (!p || p.userId !== uid) return null
    return {
      userId: uid,
      photos: Array.isArray(p.photos) ? p.photos.filter(Boolean) : [],
      coverPhoto: typeof p.coverPhoto === "string" ? p.coverPhoto : null,
      updatedAt: Number(p.updatedAt) || 0,
    }
  } catch {
    return null
  }
}

/** Merge server/local profile media — prefer non-empty server, else cache */
export function mergeProfileMedia(
  userId: string | null | undefined,
  photos: string[] | undefined,
  coverPhoto: string | null | undefined
): { photos: string[]; coverPhoto: string | null } {
  const serverPhotos = Array.isArray(photos) ? photos.filter(Boolean) : []
  const serverCover =
    typeof coverPhoto === "string" && coverPhoto.length > 0 ? coverPhoto : null
  if (serverPhotos.length > 0 || serverCover) {
    return { photos: serverPhotos, coverPhoto: serverCover }
  }
  const cached = loadProfileMediaCache(userId)
  if (!cached) return { photos: serverPhotos, coverPhoto: serverCover }
  return {
    photos: cached.photos.length ? cached.photos : serverPhotos,
    coverPhoto: cached.coverPhoto || serverCover,
  }
}
