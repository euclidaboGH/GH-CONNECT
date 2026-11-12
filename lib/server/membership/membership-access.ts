/**
 * Server-only membership authorization helpers.
 * UI/domain caches may improve presentation, but never authorize a protected action.
 */
import { tryGetEntitlementAuthoritative, type MembershipTier } from "@/lib/server/membership/entitlement-store"

export type MembershipAccessResult =
  | { ok: true; allowed: true; tier: MembershipTier }
  | { ok: true; allowed: false; tier: MembershipTier; error: "MEMBERSHIP_REQUIRED" }
  | { ok: false; status: 503; error: "MEMBERSHIP_STORE_UNAVAILABLE" }

/**
 * Resolve access from the canonical server entitlement row. Store failures are
 * unavailable (503), never silently downgraded to Free or accepted as paid.
 */
export async function checkMembershipTierAccess(
  userId: string,
  allowedTiers: readonly Exclude<MembershipTier, "free">[],
): Promise<MembershipAccessResult> {
  const uid = String(userId || "").trim()
  if (!uid) return { ok: false, status: 503, error: "MEMBERSHIP_STORE_UNAVAILABLE" }

  const result = await tryGetEntitlementAuthoritative(uid)
  if (!result.ok) return { ok: false, status: 503, error: "MEMBERSHIP_STORE_UNAVAILABLE" }

  const entitlement = result.entitlement
  const isActive = entitlement.tier !== "free"
    && entitlement.active === true
    && ((entitlement.source === "comp" || entitlement.billingPeriod === "comp") && entitlement.expiresAt == null
      || Number.isFinite(entitlement.expiresAt) && Number(entitlement.expiresAt) > Date.now())
  const allowed = isActive && allowedTiers.includes(entitlement.tier as Exclude<MembershipTier, "free">)

  return allowed
    ? { ok: true, allowed: true, tier: entitlement.tier }
    : { ok: true, allowed: false, tier: entitlement.tier, error: "MEMBERSHIP_REQUIRED" }
}
