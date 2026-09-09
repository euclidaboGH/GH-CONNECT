/**
 * Local onboarding completion heuristics for returning-user UX.
 * Server onboardingCompleted remains authoritative when durable.
 * When the identity store is memory-only or races hydration, avoid
 * forcing registration again if a complete local profile already exists.
 */

import type { Profile } from "@/lib/ghc-types"
import { readLocalProfiles, findLocalProfile } from "@/lib/local-profiles"

export function isCompletedProfileShape(p: Partial<Profile> | null | undefined): boolean {
  if (!p) return false
  if (p.onboarded === true) return true
  const name = typeof p.displayName === "string" ? p.displayName.trim() : ""
  const photos = Array.isArray(p.photos) ? p.photos : []
  if (name.length > 0 && photos.length > 0) return true
  if (name.length > 0 && Array.isArray(p.interests) && p.interests.length >= 2) return true
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
        let activeId = activeRaw
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
}): "unknown" | "required" | "complete" {
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
