/**
 * Local multi-profile storage API.
 *
 * Provides a consistent, module-scoped interface for reading/writing
 * local profiles in localStorage. Used by GHCProvider and any other
 * code that needs to work with local preview profiles.
 *
 * Storage layout:
 *   - ghc.local-profile-index.v1  → string[] of localIds
 *   - ghc.local-profile.<id>      → LocalProfileRecord JSON
 *   - ghc.local-profiles.v1       → legacy aggregate array (kept for compatibility)
 *   - ghc.active-profile.v1       → currently active localId
 */

import type { Profile, Candidate } from "./ghc-types"

export const LOCAL_PROFILES_KEY = "ghc.local-profiles.v1"
export const LOCAL_PROFILE_INDEX_KEY = "ghc.local-profile-index.v1"
export const LOCAL_PROFILE_PREFIX = "ghc.local-profile."
export const LOCAL_ACTIVE_PROFILE_KEY = "ghc.active-profile.v1"

export type LocalProfileRecord = Profile & { localId: string }

function isValidLocalProfile(value: unknown): value is LocalProfileRecord {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as LocalProfileRecord).localId === "string" &&
    typeof (value as LocalProfileRecord).displayName === "string"
  )
}

/**
 * Convert a local profile record into a Candidate for discovery/matching UIs.
 */
export function profileToLocalCandidate(profile: LocalProfileRecord): Candidate {
  return {
    id: profile.localId,
    name: profile.displayName || "Pi Member",
    age: typeof profile.age === "number" ? profile.age : 25,
    location: [profile.city, profile.country].filter(Boolean).join(", ") || "Unknown",
    bio: profile.bio || "Open to meaningful connections.",
    photo: profile.photos?.[0] || "/placeholder.svg?height=320&width=320",
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    verified: Boolean(profile.verified),
    online: true,
    lastSeen: Date.now(),
  }
}

/**
 * Read all local profiles from localStorage.
 * Prefers the indexed per-profile keys; falls back to the legacy aggregate key.
 */
export function readLocalProfiles(): LocalProfileRecord[] {
  if (typeof window === "undefined") return []

  try {
    const rawIndex = window.localStorage.getItem(LOCAL_PROFILE_INDEX_KEY)
    const index = rawIndex ? JSON.parse(rawIndex) : []
    const ids = Array.isArray(index)
      ? index.filter((id): id is string => typeof id === "string")
      : []

    if (ids.length > 0) {
      const keyed = ids
        .map((id) => {
          try {
            const raw = window.localStorage.getItem(`${LOCAL_PROFILE_PREFIX}${id}`)
            return raw ? JSON.parse(raw) : null
          } catch {
            return null
          }
        })
        .filter(isValidLocalProfile)

      if (keyed.length > 0) return keyed
    }

    // Legacy fallback
    const rawLegacy = window.localStorage.getItem(LOCAL_PROFILES_KEY)
    const legacy = rawLegacy ? JSON.parse(rawLegacy) : []
    return Array.isArray(legacy) ? legacy.filter(isValidLocalProfile) : []
  } catch {
    return []
  }
}

/**
 * Persist a single local profile and update the index + legacy aggregate.
 * Keeps at most 50 profiles.
 */
export function writeLocalProfile(profile: LocalProfileRecord): void {
  if (typeof window === "undefined") return
  if (!isValidLocalProfile(profile)) return

  try {
    const existing = readLocalProfiles()
    const ids = existing
      .map((item) => item.localId)
      .filter((id) => id !== profile.localId)
    const nextIds = [...ids, profile.localId].slice(-50)

    window.localStorage.setItem(
      `${LOCAL_PROFILE_PREFIX}${profile.localId}`,
      JSON.stringify(profile)
    )
    window.localStorage.setItem(LOCAL_PROFILE_INDEX_KEY, JSON.stringify(nextIds))

    // Keep the legacy aggregate readable for older preview sessions.
    const aggregate = nextIds
      .map((id) =>
        id === profile.localId
          ? profile
          : existing.find((item) => item.localId === id)
      )
      .filter(isValidLocalProfile)

    window.localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(aggregate))
  } catch {
    // local preview storage is best-effort
  }
}

/**
 * Get the currently active local profile id (or null).
 */
export function getActiveLocalProfileId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(LOCAL_ACTIVE_PROFILE_KEY)
  } catch {
    return null
  }
}

/**
 * Set the currently active local profile id.
 */
export function setActiveLocalProfileId(localId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LOCAL_ACTIVE_PROFILE_KEY, localId)
  } catch {
    // best-effort
  }
}

/**
 * Find a local profile by its localId.
 */
export function findLocalProfile(localId: string): LocalProfileRecord | undefined {
  return readLocalProfiles().find((p) => p.localId === localId)
}
