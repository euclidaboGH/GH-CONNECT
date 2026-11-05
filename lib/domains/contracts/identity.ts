/**
 * Identity / Profile domain contract.
 * Authority: IdentityService + profile session; never GHC balance.
 */

import type { DomainResult, DomainEmptyState } from "./types"

export interface IdentitySnapshot {
  userId: string
  piUserId: string | null
  username: string | null
  displayName: string
  ghId: string | null
  avatarUrl: string | null
  bio: string | null
  locationLabel: string | null
  profession: string | null
  interests: string[]
  onboarded: boolean
  profileCompletionPercent: number
  verificationState: "unverified" | "pending" | "verified" | string
}

export interface IdentityDomainContract {
  getSnapshot(): DomainResult<IdentitySnapshot>
  /** Profile completion empty state for Home command centre */
  completionEmptyState(): DomainEmptyState
}

export function defaultIdentityEmptyState(): DomainEmptyState {
  return {
    title: "Complete your profile",
    description: "Add a photo, bio, and interests so people can understand who you are.",
    primaryAction: { label: "Edit profile", tab: "profile" },
  }
}
