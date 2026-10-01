/**
 * Local onboarding completion heuristics for returning-user UX.
 * Server onboardingCompleted remains authoritative when durable.
 * When the identity store is memory-only or races hydration, avoid
 * forcing registration again if a complete local profile already exists.
 */

import type { Profile } from "@/lib/ghc-types"
import { readLocalProfiles, findLocalProfile } from "@/lib/local-profiles"

export type ClientOnboardingStatus = "unknown" | "required" | "complete" | "unavailable"

/** Device stamp written after successful onboarding — survives PIN unlock / remount */
const ONBOARDING_STAMP_KEY = "ghc.onboarding.completed.v1"

export function stampLocalOnboardingComplete(input?: {
  userId?: string | null
  username?: string | null
}): void {
  if (typeof window === "undefined") return
  try {
    const payload = {
      at: Date.now(),
      userId: input?.userId || null,
      username: input?.username || null,
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
} | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STAMP_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as {
      at?: number
      userId?: string | null
      username?: string | null
    }
    if (!p || typeof p.at !== "number") return null
    return {
      at: p.at,
      userId: p.userId ? String(p.userId) : null,
      username: p.username ? String(p.username) : null,
    }
  } catch {
    return null
  }
}

/** True when this device has completed onboarding for the same (or sole) user */
export function hasLocalOnboardingStampForUser(input: {
  userId?: string | null
  username?: string | null
}): boolean {
  const stamp = readLocalOnboardingStamp()
  if (!stamp) return false
  const uid = (input.userId || "").trim()
  const un = (input.username || "").trim().toLowerCase()
  if (uid && stamp.userId && stamp.userId === uid) return true
  if (un && stamp.username && stamp.username.toLowerCase() === un) return true
  // Same device, stamp exists, identity ids still hydrating — do not force registration
  if (!uid && !un && stamp.at > 0) return true
  // Stamp without userId (older) + current user present: still honor device completion
  if (stamp.at > 0 && !stamp.userId && !stamp.username) return true
  return false
}

export function isCompletedProfileShape(p: Partial<Profile> | null | undefined): boolean {
  if (!p) return false
  if (p.onboarded === true) return true
  const name = typeof p.displayName === "string" ? p.displayName.trim() : ""
  const photos = Array.isArray(p.photos) ? p.photos : []
  if (name.length > 0 && photos.length > 0) return true
  if (name.length > 0 && Array.isArray(p.interests) && p.interests.length >= 2) return true
  // Name + city + mode is enough signal of a finished registration form
  if (
    name.length > 0 &&
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
}): Profile | null {
  if (typeof window === "undefined") return null
  try {
    const locals = readLocalProfiles()
    for (const lp of locals) {
      if (!isCompletedProfileShape(lp)) continue
      if (input.userId && (lp.id === input.userId || (lp as { localId?: string }).localId === input.userId)) {
        return lp
      }
      if (
        input.username &&
        (lp.username === input.username || lp.displayName === input.username)
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
          if (active && isCompletedProfileShape(active)) return active
        }
      }
    } catch {
      /* */
    }
    const raw = window.localStorage.getItem("ghc.profile")
    if (raw) {
      const p = JSON.parse(raw) as Profile
      if (isCompletedProfileShape(p)) return p
    }
    // Session / legacy keys sometimes used after PIN unlock
    for (const key of ["ghc.profile.v1", "greenhaven.profile", "gh-connect.profile"]) {
      try {
        const r = window.localStorage.getItem(key)
        if (!r) continue
        const p = JSON.parse(r) as Profile
        if (isCompletedProfileShape(p)) return p
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
 * Prefer server when durable returning; otherwise honor completed local profile.
 */
export function resolveClientOnboardingStatus(input: {
  serverVerified: boolean
  needsOnboarding: boolean
  isReturning: boolean
  userId?: string | null
  username?: string | null
}): ClientOnboardingStatus {
  if (!input.serverVerified) return "unknown"
  if (input.isReturning || input.needsOnboarding === false) return "complete"
  const local = findCompletedLocalProfileForUser({
    userId: input.userId,
    username: input.username,
  })
  if (local) return "complete"
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
}): ClientOnboardingStatus {
  const pi = input.piOnboardingStatus

  // Explicit unavailable / failed persistence — never treat as new user
  if (pi === "unavailable") return "unavailable"

  // Authoritative server complete wins immediately
  if (pi === "complete") return "complete"

  // Completed profile in session state (after validated completeOnboarding)
  const profileComplete = isCompletedProfileShape(input.profile)
  if (profileComplete) return "complete"

  const uid =
    input.userId || (input.profile as { id?: string } | undefined)?.id || null
  const un =
    input.username ||
    (input.profile as { username?: string } | undefined)?.username ||
    (input.profile as { displayName?: string } | undefined)?.displayName ||
    null

  // Device stamp from a previous successful finish on this phone (PIN unlock / remount safe)
  if (hasLocalOnboardingStampForUser({ userId: uid, username: un })) {
    return "complete"
  }

  // Device-local completed profile for this same user — recovery when server
  // still says required (legacy rows / failed onboarding-complete write).
  if (pi === "required" || input.serverVerified) {
    const local = findCompletedLocalProfileForUser({
      userId: uid,
      username: un,
    })
    if (local) return "complete"
  }

  if (pi === "required") return "required"

  // unknown: keep loading shell — never force registration from userId alone
  return "unknown"
}
