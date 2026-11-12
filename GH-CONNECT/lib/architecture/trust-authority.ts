/**
 * Trust authority (Step 2).
 * Verification + reputation must not be client-authoritative in production.
 */

import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { isProductionAuthorityContext } from "@/lib/architecture/authority"

/** Production-like: no Studio/demo shortcuts */
export function isTrustProductionMode(): boolean {
  return isProductionAuthorityContext() && !isDemoDataAllowed()
}

/**
 * Privileged verification mutations (approve/reject/revoke).
 * Browser production clients: denied.
 * Server routes may set GHC_VERIFICATION_SERVER=1.
 */
export function canMutateVerificationPrivileged(): boolean {
  if (!isTrustProductionMode()) return true
  return process.env.GHC_VERIFICATION_SERVER === "1"
}

/**
 * Arbitrary reputation deltaOverride / cross-user write.
 * Production browser: denied. Server may set GHC_REPUTATION_SERVER=1.
 */
export function canMutateReputationPrivileged(): boolean {
  if (!isTrustProductionMode()) return true
  return process.env.GHC_REPUTATION_SERVER === "1"
}

/**
 * Self-issued reputation signals (fixed weights only) allowed in Studio.
 * In production, client self-signals are staged/local only and must not
 * drive public badges — recordSignal still stores Class D cache but
 * privileged overrides are blocked.
 */
export function canRecordClientReputationSignal(): boolean {
  // Always allow fixed-weight self signals into Class D cache for UX continuity;
  // public display must use server/profile flags in production.
  return true
}

/**
 * Public "verified" badge — production only trusts profile.verified
 * (set by server/session), never localStorage verification domain alone.
 */
export function canShowVerifiedBadge(input: {
  profileVerified?: boolean | null
  domainIdentityVerified?: boolean | null
  domainAnyVerified?: boolean | null
}): boolean {
  if (isTrustProductionMode()) {
    return input.profileVerified === true
  }
  return (
    input.profileVerified === true ||
    input.domainIdentityVerified === true ||
    input.domainAnyVerified === true
  )
}
