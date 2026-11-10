/**
 * Identity domain — profile, onboarding, local multi-profile helpers.
 *
 * Canonical owner of identity *mutations* and read models.
 * Session cache + React state remain in GHCContext until IdentityProvider exists.
 * Auth transport stays in Pi auth context; this domain does not replace SDK login.
 *
 * Alias: createUserDomain === createIdentityDomain (compat).
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import type { DomainUser } from "./types"
import type { Profile } from "../ghc-types"
import { defaultProfile, generateId } from "../ghc-data"
import type { LocalProfileRecord } from "../local-profiles"

export interface IdentityDomainDeps {
  getProfile: () => Profile
  currentUserId?: string
  /** Optional sanitizer applied before validate/mutate */
  sanitizeProfileUpdates?: (updates: Partial<Profile>) => Partial<Profile>
}

export function createIdentityDomain(deps: IdentityDomainDeps) {
  const actorId = deps.currentUserId || "current-user"

  function toDomainUser(p: Profile): DomainUser {
    return {
      id: actorId,
      displayName: p.displayName,
      avatar: p.photos?.[0],
      coverPhoto: p.coverPhoto || undefined,
      bio: p.bio,
      location: [p.city, p.country].filter(Boolean).join(", "),
      verified: p.verified,
      createdAt: p.createdAt,
    }
  }

  return {
    /** Stable actor id for this session */
    currentUserId(): string {
      return actorId
    },

    /** Raw profile blob (session source of truth until backend profile repo) */
    getProfile(): Profile {
      return deps.getProfile()
    },

    /** Normalized domain user view */
    getCurrentUser(): DomainUser {
      return toDomainUser(deps.getProfile())
    },

    isOnboarded(): boolean {
      return Boolean(deps.getProfile().onboarded)
    },

    /**
     * Profile update through golden mutation pipeline.
     * Caller applies `result.data` into session cache (GHCContext).
     */
    async updateProfile(
      updates: Partial<Profile>
    ): Promise<MutationResult<Partial<Profile>>> {
      return runMutation({
        name: "identity.updateProfile",
        actorId,
        input: updates,
        validate: (u) => {
          const cleaned = deps.sanitizeProfileUpdates ? deps.sanitizeProfileUpdates(u) : u
          if (cleaned.displayName !== undefined && !String(cleaned.displayName).trim()) {
            return "Display name is required"
          }
          if (cleaned.bio !== undefined && String(cleaned.bio).length > 500) {
            return "Bio is too long (max 500)"
          }
          if (cleaned.age !== undefined && (Number(cleaned.age) < 18 || Number(cleaned.age) > 120)) {
            return "Age must be 18–120"
          }
          return null
        },
        mutate: (u) => {
          const cleaned = deps.sanitizeProfileUpdates ? deps.sanitizeProfileUpdates(u) : u
          // Strip undefined so merge is clean
          const next: Partial<Profile> = {}
          for (const [k, v] of Object.entries(cleaned)) {
            if (v !== undefined) (next as any)[k] = v
          }
          return next
        },
        eventType: "PROFILE_UPDATED",
        eventPayload: (u) => ({ updates: u }),
      })
    },

    async completeOnboarding(): Promise<MutationResult<{ onboarded: true }>> {
      return runMutation({
        name: "identity.completeOnboarding",
        actorId,
        input: {},
        mutate: () => ({ onboarded: true as const }),
        eventType: "ONBOARDING_COMPLETED",
        eventPayload: () => ({ userId: actorId }),
      })
    },

    /**
     * Build a new local multi-profile record (does not write storage — caller uses local-profiles API).
     */
    buildLocalProfile(partial: Partial<Profile>): LocalProfileRecord {
      const base = defaultProfile()
      return {
        ...base,
        ...partial,
        localId: `local-${generateId()}`,
        onboarded: true,
        createdAt: Date.now(),
      }
    },

    /**
     * Session clear signal after logout (does not touch Pi SDK).
     * Caller resets React state to initial.
     */
    async clearSession(): Promise<MutationResult<{ cleared: true }>> {
      return runMutation({
        name: "identity.clearSession",
        actorId,
        input: {},
        mutate: () => ({ cleared: true as const }),
        eventType: "SESSION_CLEARED",
        eventPayload: () => ({ userId: actorId }),
      })
    },
  }
}

/** @deprecated Prefer createIdentityDomain — same implementation */
export const createUserDomain = createIdentityDomain

export type IdentityDomain = ReturnType<typeof createIdentityDomain>
export type UserDomain = IdentityDomain
