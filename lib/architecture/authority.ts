/**
 * Runtime authority helpers — Prompt #50 / Step 2
 * Class A/B financial systems must never fall back to Class D localStorage truth.
 */

import { isDemoDataAllowed } from "@/lib/demo-data-policy"

export type AuthorityClass = "A" | "B" | "C" | "D" | "E"

/** True when running in a production-like context (no studio/demo). */
export function isProductionAuthorityContext(): boolean {
  if (isDemoDataAllowed()) return false
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GHC_STUDIO === "true") return false
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DISCOVERY_DEMO === "true") return false
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return true
  return false
}

export type { } // trust privileged checks live in trust-authority.ts

/** @deprecated Prefer @/lib/architecture/trust-authority */
export function canMutateVerificationPrivileged(): boolean {
  // Lazy require pattern avoided — duplicate minimal check matching trust-authority
  if (!isProductionAuthorityContext()) return true
  return process.env.GHC_VERIFICATION_SERVER === "1"
}

export function authorityLabel(domain: string, cls: AuthorityClass): string {
  return `${domain}:Class-${cls}`
}
