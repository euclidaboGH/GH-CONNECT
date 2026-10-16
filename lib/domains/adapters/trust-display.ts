/**
 * Trust display adapters — UI must not invent verified/reputation truth.
 */

import { canShowVerifiedBadge } from "@/lib/architecture/trust-authority"
import { isTrustProductionMode } from "@/lib/architecture/trust-authority"

export function resolveVerifiedBadge(input: {
  profileVerified?: boolean | null
  domainIdentityVerified?: boolean | null
  domainAnyVerified?: boolean | null
}): boolean {
  return canShowVerifiedBadge(input)
}

/** Reputation score display: production UI should prefer server snapshot when present */
export function resolveReputationDisplay(input: {
  serverScore?: number | null
  localScore?: number | null
}): { score: number | null; source: "server" | "local" | "none"; provisional: boolean } {
  if (typeof input.serverScore === "number" && Number.isFinite(input.serverScore)) {
    return { score: input.serverScore, source: "server", provisional: false }
  }
  if (isTrustProductionMode()) {
    // Do not show localStorage reputation as authoritative in production
    return { score: null, source: "none", provisional: false }
  }
  if (typeof input.localScore === "number" && Number.isFinite(input.localScore)) {
    return { score: input.localScore, source: "local", provisional: true }
  }
  return { score: null, source: "none", provisional: false }
}
