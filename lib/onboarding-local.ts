/**
 * Local onboarding completion heuristics for returning-user UX.
 * Server onboardingCompleted remains authoritative when durable and true.
 * When the identity store is memory-only, races hydration, or never stamped
 * onboardingCompleted, avoid forcing registration again if this device already
 * finished GreenHaven setup for the same person.
 */

import type { Profile } from "@/lib/ghc-types"
import { readLocalProfiles, findLocalProfile } from "@/lib/local-profiles"

export type ClientOnboardingStatus = "unknown" | "required" | "complete" | "unavailable"

/** Device stamp written after successful onboarding — survives PIN unlock / remount */
const ONBOARDING_STAMP_KEY = "ghc.onboarding.completed.v1"

export function stampLocalOnboardingComplete(input?: {
  userId?: string | null
  username?: string | null
  /** Optional alternate ids (Pi uid, GH id) so remount matching is robust */
  altUserIds?: Array<string | null | undefined>
}): void {
  if (typeof window === "undefined") return
  try {
    const ids = new Set<string>()
    const primary = (input?.userId || "").trim()
    if (primary) ids.add(primary)
    for (const a of input?.altUserIds || []) {
      const t = (a || "").trim()
      if (t) ids.add(t)
    }
    const payload = {
      at: Date.now(),
      userId: primary || (ids.size ? [...ids][0] : null),
      username: input?.username || null,
      altUserIds: [...ids],
    }
    window.localStorage.setItem(ONBOARDING_STAMP_KEY, JSON.stringify(payload))
  } catch {
    /* */
  }
}

export function readLocalOnboardingStamp(): {
  at: number
  userId: string | null
  username: string | null
  altUserIds: string[]
} | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STAMP_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as {
      at?: number
      userId?: string | null
      username?: string | null
      altUserIds?: unknown
    }
    if (!p || typeof p.at !== "number") return null
    const alts: string[] = []
    if (Array.isArray(p.altUserIds)) {
      for (const x of p.altUserIds) {
        if (typeof x === "string" && x.trim()) alts.push(x.trim())
      }
    }
    if (p.userId && !alts.includes(String(p.userId))) alts.push(String(p.userId))
    return {
      at: p.at,
      userId: p.userId ? String(p.userId) : null,
      username: p.username ? String(p.username) : null,
      altUserIds: alts,
    }
  } catch {
    return null
  }
}

function normId(s: string | null | undefined): string {
  return (s || "").trim()
}

function idsOverlap(
  candidates: Array<string | null | undefined>,
  stampIds: string[]
): boolean {
  const set = new Set(stampIds.map((x) => x.trim()).filter(Boolean))
  if (set.size === 0) return false
  for (const c of candidates) {
    const t = normId(c)
    if (t && set.has(t)) return true
  }
  return false
}

/** True when this device has completed onboarding for the same (or sole) user */
export function hasLocalOnboardingStampForUser(input: {
  userId?: string | null
  username?: string | null
  /** Pi app uid, GH user id, and any aliases from auth lifecycle */
  candidateUserIds?: Array<string | null | undefined>
}): boolean {
  const stamp = readLocalOnboardingStamp()
  if (!stamp) return false

  const candidates = [
    input.userId,
    ...(input.candidateUserIds || []),
  ]
  if (idsOverlap(candidates, stamp.altUserIds.length ? stamp.altUserIds : [stamp.userId || ""])) {
    return true
  }

  const un = (input.username || "").trim().toLowerCase()
  if (un && stamp.username && stamp.username.toLowerCase() === un) return true

  // Same device, stamp exists, identity ids still hydrating — do not force registration
  const anyCandidate = candidates.some((c) => normId(c).length > 0)
  if (!anyCandidate && !un && stamp.at > 0) return true

  // Stamp without bound user (older) + current user present: honor device completion
  if (stamp.at > 0 && !stamp.userId && !stamp.username && stamp.altUserIds.length === 0) {
    return true
  }

  // Single-user device: stamp exists with a bound id, current session has a verified id
  // but ids differ only by format race (common Pi uid vs GH id). Prefer not forcing
  // registration when a completed local profile also exists for this username.
  if (stamp.at > 0 && un && stamp.username && stamp.username.toLowerCase() === un) {
    return true
  }

  return false
}

export function isCompletedProfileShape(p: Partial<Profile> | null | undefined): boolean {
  if (!p) return false
  if (p.onboarded === true) return true
  const name = typeof p.displayName === "string" ? p.displayName.trim() : ""
  if (!name) return false
  const photos = Array.isArray(p.photos) ? p.photos : []
  if (photos.length > 0) return true
  if (Array.isArray(p.interests) && p.interests.length >= 2) return true
  // Name + city + mode is enough signal of a finished registration form
  if (
    typeof p.city === "string" &&
    p.city.trim().length > 0 &&
    typeof p.primaryMode === "string" &&
    p.primaryMode.length > 0
  ) {
    return true
  }
  // Returning-user recovery: name alone after a prior session is weak but better
  // than wiping them through full registration when a device stamp also exists.
  // Callers that need strict shape should check stamp separately.
  return false
}

/** Stricter shape for "looks like they finished the form" without stamp */
export function isStrongCompletedProfileShape(p: Partial<Profile> | null | undefined): boolean {
  if (!p) return false
  if (p.onboarded === true) return true
  const name = typeof p.displayName === "string" ? p.displayName.trim() : ""
  if (!name) return false
  const photos = Array.isArray(p.photos) ? p.photos : []
  if (photos.length > 0) return true
  if (Array.isArray(p.interests) && p.interests.length >= 2) return true
  if (
    typeof p.city === "string" &&
    p.city.trim().length > 0 &&
    typeof p.primaryMode === "string" &&
    p.primaryMode.length > 0
  ) {
    return true
  }
  return false
}

/** Find a completed local profile matching Pi/GH user id or username */
export function findCompletedLocalProfileForUser(input: {
  userId?: string | null
  username?: string | null
  candidateUserIds?: Array<string | null | undefined>
}): Profile | null {
  if (typeof window === "undefined") return null
  const ids = new Set<string>()
  for (const x of [input.userId, ...(input.candidateUserIds || [])]) {
    const t = normId(x)
    if (t) ids.add(t)
  }
  const un = (input.username || "").trim().toLowerCase()
  try {
    const locals = readLocalProfiles()
    for (const lp of locals) {
      if (!isStrongCompletedProfileShape(lp) && !isCompletedProfileShape(lp)) continue
      const lpId = normId(lp.id)
      const localId = normId((lp as { localId?: string }).localId)
      if (lpId && ids.has(lpId)) return lp
      if (localId && ids.has(localId)) return lp
      if (
        un &&
        (String(lp.username || "").toLowerCase() === un ||
          String(lp.displayName || "").toLowerCase() === un)
      ) {
        return lp
      }
    }
    try {
      const activeRaw = window.localStorage.getItem("ghc.active-profile.v1")
      if (activeRaw) {
        let activeId: unknown = activeRaw
        try {
          activeId = JSON.parse(activeRaw)
        } catch {
          /* plain string */
        }
        if (typeof activeId === "string") {
          const active = findLocalProfile(activeId)
          if (active && (isStrongCompletedProfileShape(active) || isCompletedProfileShape(active))) {
            return active
          }
        }
      }
    } catch {
      /* */
    }
    const raw = window.localStorage.getItem("ghc.profile")
    if (raw) {
      const p = JSON.parse(raw) as Profile
      if (isStrongCompletedProfileShape(p) || isCompletedProfileShape(p)) return p
    }
    for (const key of ["ghc.profile.v1", "greenhaven.profile", "gh-connect.profile"]) {
      try {
        const r = window.localStorage.getItem(key)
        if (!r) continue
        const p = JSON.parse(r) as Profile
        if (isStrongCompletedProfileShape(p) || isCompletedProfileShape(p)) return p
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }
  return null
}

/**
 * Resolve client onboarding status after server bridge.
 * Prefer server when durable returning; otherwise honor completed local profile / stamp.
 */
export function resolveClientOnboardingStatus(input: {
  serverVerified: boolean
  needsOnboarding: boolean
  isReturning: boolean
  /** Identity row existed before this login (may still need onboarding form) */
  identityExisted?: boolean
  userId?: string | null
  username?: string | null
  candidateUserIds?: Array<string | null | undefined>
}): ClientOnboardingStatus {
  if (!input.serverVerified) return "unknown"
  // Server says finished
  if (input.isReturning || input.needsOnboarding === false) return "complete"

  const candidates = [input.userId, ...(input.candidateUserIds || [])]
  if (
    hasLocalOnboardingStampForUser({
      userId: input.userId,
      username: input.username,
      candidateUserIds: candidates,
    })
  ) {
    return "complete"
  }

  const local = findCompletedLocalProfileForUser({
    userId: input.userId,
    username: input.username,
    candidateUserIds: candidates,
  })
  if (local && isStrongCompletedProfileShape(local)) return "complete"
  // Existing Pi identity + any completed local profile → do not re-register
  if (input.identityExisted && local) return "complete"

  if (input.needsOnboarding) return "required"
  return "unknown"
}

/**
 * UI gate authority used by app shell.
 * Never treat "unknown" as "required". Never flash registration for completed locals.
 */
export function resolveUiOnboardingGate(input: {
  profile: Partial<Profile> | null | undefined
  piOnboardingStatus: ClientOnboardingStatus | string
  serverVerified: boolean
  userId?: string | null
  username?: string | null
  candidateUserIds?: Array<string | null | undefined>
}): ClientOnboardingStatus {
  const pi = input.piOnboardingStatus

  if (pi === "unavailable") return "unavailable"
  if (pi === "complete") return "complete"

  // Explicit onboarded flag on in-memory profile
  if (input.profile && (input.profile as { onboarded?: boolean }).onboarded === true) {
    return "complete"
  }

  const profileStrong = isStrongCompletedProfileShape(input.profile)
  if (profileStrong) return "complete"

  const uid =
    input.userId || (input.profile as { id?: string } | undefined)?.id || null
  const un =
    input.username ||
    (input.profile as { username?: string } | undefined)?.username ||
    (input.profile as { displayName?: string } | undefined)?.displayName ||
    null
  const candidates = [
    uid,
    ...(input.candidateUserIds || []),
    (input.profile as { id?: string } | undefined)?.id,
  ]

  // Device stamp from a previous successful finish on this phone
  if (
    hasLocalOnboardingStampForUser({
      userId: uid,
      username: un,
      candidateUserIds: candidates,
    })
  ) {
    return "complete"
  }

  // Device-local completed profile for this same user
  if (pi === "required" || input.serverVerified) {
    const local = findCompletedLocalProfileForUser({
      userId: uid,
      username: un,
      candidateUserIds: candidates,
    })
    if (local && (isStrongCompletedProfileShape(local) || isCompletedProfileShape(local))) {
      return "complete"
    }
  }

  if (pi === "required") return "required"

  // unknown: keep loading shell — never force registration from userId alone
  return "unknown"
}
