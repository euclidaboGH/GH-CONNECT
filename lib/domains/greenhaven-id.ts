/**
 * Public GreenHaven ID — safe to share for Receive GHC.
 * Not an auth token, email, phone, or internal UUID presentation.
 *
 * Strategy:
 * - Prefer existing public handle if profile exposes one
 * - Else stable GH-XXXXXX derived from userId (deterministic, no per-load regen)
 * - Optional local map only as cache; not the sole long-term authority
 */

const CACHE_KEY = "ghc_public_id_map_v1"

/** Public ID format: GH- then 6 alphanumeric (uppercase) */
export const GH_ID_REGEX = /^GH-[A-Z0-9]{6}$/

export function normalizeGreenHavenId(raw: string): string {
  let s = String(raw || "").trim()
  if (s.startsWith("@")) s = s.slice(1)
  s = s.toUpperCase()
  // Allow users to paste gh-xxxx
  if (/^GH-[A-Z0-9]{6}$/i.test(s)) return s.toUpperCase()
  // Bare 6-char code
  if (/^[A-Z0-9]{6}$/.test(s)) return `GH-${s}`
  return s
}

export function isValidGreenHavenIdFormat(id: string): boolean {
  return GH_ID_REGEX.test(normalizeGreenHavenId(id))
}

/** FNV-1a style hash → base36 fragment for stable IDs */
function stableHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // unsigned
  const u = h >>> 0
  return u.toString(36).toUpperCase().padStart(6, "0").slice(0, 6)
}

/**
 * Derive a stable public GreenHaven ID from an internal user id.
 * Collision-resistant enough for product scale; server should still enforce uniqueness later.
 */
export function deriveGreenHavenId(userId: string): string {
  const base = String(userId || "user").trim() || "user"
  return `GH-${stableHash(`ghc-public-v1:${base}`)}`
}

function readCache(): Record<string, string> {
  try {
    if (typeof localStorage === "undefined") return {}
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeCache(map: Record<string, string>) {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

/**
 * Resolve the public GreenHaven ID for a user.
 * Does not regenerate when already cached for that userId.
 */
export function getOrCreateGreenHavenId(userId: string, preferredHandle?: string | null): string {
  const uid = String(userId || "").trim() || "current-user"
  if (preferredHandle) {
    const n = normalizeGreenHavenId(preferredHandle)
    if (GH_ID_REGEX.test(n)) {
      const map = readCache()
      map[uid] = n
      writeCache(map)
      return n
    }
  }
  const map = readCache()
  if (map[uid] && GH_ID_REGEX.test(map[uid])) return map[uid]
  const derived = deriveGreenHavenId(uid)
  map[uid] = derived
  writeCache(map)
  return derived
}

/** Lookup userId from a public GreenHaven ID using local cache + directory probe */
export function resolveUserIdFromGreenHavenId(
  publicId: string,
  directory: Array<{ id: string; name?: string; greenHavenId?: string }> = []
): { userId: string; name: string; greenHavenId: string } | null {
  const id = normalizeGreenHavenId(publicId)
  if (!GH_ID_REGEX.test(id)) return null

  for (const row of directory) {
    const gh =
      row.greenHavenId ||
      (row.id ? deriveGreenHavenId(row.id) : "")
    if (normalizeGreenHavenId(gh) === id || normalizeGreenHavenId(row.id) === id) {
      return {
        userId: row.id,
        name: row.name || row.id,
        greenHavenId: id,
      }
    }
  }

  // Inverse cache scan
  const map = readCache()
  for (const [uid, gh] of Object.entries(map)) {
    if (gh === id) {
      return { userId: uid, name: uid, greenHavenId: id }
    }
  }

  // Deterministic: if someone uses derived id as their only id, treat GH-id as handle
  // Cannot invent random userIds — require directory hit or cache
  return null
}

export function formatGreenHavenIdDisplay(id: string): string {
  const n = normalizeGreenHavenId(id)
  return n.startsWith("GH-") ? n : `@${n}`
}

/** Phase D5 — server-backed ensure / resolve (falls back to D4 client derivation). */

export type ResolvedPublicIdentity = {
  userId: string
  publicId: string
  displayName?: string | null
  avatarUrl?: string | null
  source: "database" | "memory" | "local_fallback"
}

function authHeaders(): HeadersInit {
  try {
    const token =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("pi_access_token") ||
          localStorage.getItem("ghc_access_token") ||
          localStorage.getItem("access_token"))) ||
      ""
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/**
 * Ensure the current user's public ID via API when available.
 * Falls back to local D4 derivation and marks source as local_fallback.
 */
export async function ensureGreenHavenIdServer(
  userId: string
): Promise<ResolvedPublicIdentity> {
  const local = getOrCreateGreenHavenId(userId)
  try {
    const res = await fetch("/api/economy/public-id/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      return {
        userId,
        publicId: local,
        source: "local_fallback",
      }
    }
    const json = (await res.json()) as {
      data?: {
        publicId?: string
        userId?: string
        displayName?: string
        avatarUrl?: string
        source?: string
        recipientKey?: string
      }
      publicId?: string
    }
    const data = json.data || json
    const publicId = normalizeGreenHavenId(
      String(data.publicId || local)
    )
    if (GH_ID_REGEX.test(publicId)) {
      // keep local cache aligned with server
      try {
        const raw = localStorage.getItem("ghc_public_id_map_v1")
        const map = raw ? JSON.parse(raw) : {}
        map[userId] = publicId
        localStorage.setItem("ghc_public_id_map_v1", JSON.stringify(map))
      } catch {
        /* */
      }
    }
    return {
      userId: String(data.userId || data.recipientKey || userId),
      publicId: GH_ID_REGEX.test(publicId) ? publicId : local,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      source: (data.source as ResolvedPublicIdentity["source"]) || "database",
    }
  } catch {
    return { userId, publicId: local, source: "local_fallback" }
  }
}

/**
 * Resolve GH-XXXXXX via server; falls back to local directory/cache.
 */
export async function resolveGreenHavenIdServer(
  publicId: string,
  directory: Array<{ id: string; name?: string; greenHavenId?: string }> = []
): Promise<ResolvedPublicIdentity | null> {
  const id = normalizeGreenHavenId(publicId)
  if (!GH_ID_REGEX.test(id)) return null

  try {
    const res = await fetch(
      `/api/economy/public-id/resolve?id=${encodeURIComponent(id)}`,
      { headers: { ...authHeaders() } }
    )
    if (res.ok) {
      const json = (await res.json()) as {
        data?: {
          publicId?: string
          recipientKey?: string
          displayName?: string
          avatarUrl?: string
          source?: string
        }
      }
      const data = json.data || (json as typeof json.data)
      if (data?.recipientKey && data.publicId) {
        return {
          userId: String(data.recipientKey),
          publicId: normalizeGreenHavenId(String(data.publicId)),
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          source: (data.source as ResolvedPublicIdentity["source"]) || "database",
        }
      }
    }
  } catch {
    /* fall through */
  }

  const local = resolveUserIdFromGreenHavenId(id, directory)
  if (!local) return null
  return {
    userId: local.userId,
    publicId: local.greenHavenId,
    displayName: local.name,
    source: "local_fallback",
  }
}
