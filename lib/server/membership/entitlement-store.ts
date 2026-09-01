/**
 * Server-authoritative membership entitlements.
 * Client may display cache; tier truth lives here (or DB in production).
 *
 * FREE | VIP | VVIP — never trust client "I am VIP".
 */

export type MembershipTier = "free" | "vip" | "vvip"
export type BillingPeriod = "monthly" | "yearly" | "comp"
export type MembershipSource = "default" | "ghc" | "pi" | "external" | "comp"

export type ServerMembershipEntitlement = {
  userId: string
  tier: MembershipTier
  active: boolean
  startedAt: number
  expiresAt?: number
  billingPeriod?: BillingPeriod
  source: MembershipSource
  /** Pi payment id / GHC tx id */
  purchaseRef?: string
  paymentIntentId?: string
  updatedAt: number
  audit: Array<{ at: number; action: string; detail?: string }>
}

const g = globalThis as unknown as {
  __ghMembershipEntitlements?: Map<string, ServerMembershipEntitlement>
}

function map(): Map<string, ServerMembershipEntitlement> {
  if (!g.__ghMembershipEntitlements) g.__ghMembershipEntitlements = new Map()
  return g.__ghMembershipEntitlements
}

const PERIOD_MS: Record<string, number> = {
  monthly: 30 * 86400000,
  yearly: 365 * 86400000,
  comp: 30 * 86400000,
}

/** Catalog prices — must match commerce / membership-domain */
export const MEMBERSHIP_SERVER_CATALOG = {
  vip: { monthlyGhc: 200, yearlyGhc: 1800, monthlyPi: 1, yearlyPi: 10 },
  vvip: { monthlyGhc: 500, yearlyGhc: 4500, monthlyPi: 3, yearlyPi: 28 },
} as const

export function getEntitlement(userId: string): ServerMembershipEntitlement {
  const existing = map().get(userId)
  if (!existing) {
    const fresh: ServerMembershipEntitlement = {
      userId,
      tier: "free",
      active: true,
      startedAt: Date.now(),
      source: "default",
      updatedAt: Date.now(),
      audit: [{ at: Date.now(), action: "DEFAULT_FREE" }],
    }
    map().set(userId, fresh)
    return fresh
  }
  // Expiry check
  if (
    existing.tier !== "free" &&
    existing.expiresAt &&
    existing.expiresAt < Date.now()
  ) {
    const expired: ServerMembershipEntitlement = {
      ...existing,
      tier: "free",
      active: true,
      source: "default",
      updatedAt: Date.now(),
      audit: [
        ...existing.audit,
        { at: Date.now(), action: "EXPIRED", detail: existing.tier },
      ].slice(-40),
    }
    map().set(userId, expired)
    return expired
  }
  return existing
}

export function grantEntitlement(input: {
  userId: string
  tier: "vip" | "vvip"
  billingPeriod: BillingPeriod
  source: MembershipSource
  purchaseRef: string
  paymentIntentId?: string
}): ServerMembershipEntitlement {
  const now = Date.now()
  const prev = getEntitlement(input.userId)
  // Idempotent: same purchaseRef
  if (prev.purchaseRef === input.purchaseRef && prev.tier === input.tier) {
    return prev
  }
  const duration = PERIOD_MS[input.billingPeriod] || PERIOD_MS.monthly
  const next: ServerMembershipEntitlement = {
    userId: input.userId,
    tier: input.tier,
    active: true,
    startedAt: now,
    expiresAt: input.billingPeriod === "comp" ? undefined : now + duration,
    billingPeriod: input.billingPeriod,
    source: input.source,
    purchaseRef: input.purchaseRef,
    paymentIntentId: input.paymentIntentId,
    updatedAt: now,
    audit: [
      ...(prev.audit || []),
      {
        at: now,
        action: "GRANT",
        detail: `${input.tier}/${input.billingPeriod}/${input.source}`,
      },
    ].slice(-40),
  }
  map().set(input.userId, next)
  return next
}
