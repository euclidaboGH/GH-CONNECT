/**
 * Premium Membership domain — FREE | VIP | VVIP
 *
 * Separate from GHC, Reputation, and Verification.
 * Benefits are data-driven entitlements (no UI hardcoding).
 * Pricing is configurable without rewriting app logic.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { domainEvents } from "../realtime/event-bus"

export type MembershipTierId = "free" | "vip" | "vvip"

/** Entitlement keys — check via hasEntitlement(), not scattered UI conditionals */
export type EntitlementKey =
  | "badge_vip"
  | "badge_vvip"
  | "discovery_advanced_filters"
  | "discovery_priority"
  | "matching_enhanced_controls"
  | "matching_advanced"
  | "profile_customization"
  | "profile_premium_presentation"
  | "boost_post"
  | "boost_profile"
  | "story_analytics"
  | "marketplace_enhanced_visibility"
  | "marketplace_advanced_tools"
  | "community_premium_tools"
  | "community_advanced"
  | "media_limits_elevated"
  | "media_limits_max"
  | "ghc_earning_boost"
  | "ghc_earning_boost_high"
  | "platform_fee_discount"
  | "analytics_advanced"
  | "creator_business_tools"
  | "priority_support"
  | "exclusive_experiences"
  | "storage_elevated"

export interface MembershipPlan {
  id: MembershipTierId
  label: string
  /** GHC price for in-app purchase path (0 = free). External payments can ignore. */
  priceGhcMonthly: number
  priceGhcYearly: number
  entitlements: EntitlementKey[]
  /** Soft limits */
  mediaMaxPhotos: number
  mediaMaxStoryMb: number
  dailyBoosts: number
  ghcDailyEarnMultiplier: number
  platformFeeDiscountPct: number
}

export interface MembershipStatus {
  userId: string
  tier: MembershipTierId
  active: boolean
  startedAt?: number
  expiresAt?: number
  billingPeriod?: "monthly" | "yearly" | "lifetime" | "comp"
  lastPurchaseTxId?: string
  source?: "ghc" | "external" | "admin" | "default" | "trial"
  /**
   * Account/trial anchor (ms). Trial tiers are derived from this timestamp
   * so refresh/login/device cannot reset the 24h VVIP → 24h VIP window.
   */
  trialAnchorAt?: number
  /** When set, paid/comp membership overrides trial until expiry */
  lifecycle?: "trial" | "standard"
}

/** Configurable catalog — change prices/benefits without rewriting UI */
export const MEMBERSHIP_PLANS: Record<MembershipTierId, MembershipPlan> = {
  free: {
    id: "free",
    label: "Free",
    priceGhcMonthly: 0,
    priceGhcYearly: 0,
    entitlements: [],
    mediaMaxPhotos: 6,
    mediaMaxStoryMb: 20,
    dailyBoosts: 0,
    ghcDailyEarnMultiplier: 1,
    platformFeeDiscountPct: 0,
  },
  vip: {
    id: "vip",
    label: "VIP",
    priceGhcMonthly: 200,
    priceGhcYearly: 1800,
    entitlements: [
      "badge_vip",
      "discovery_advanced_filters",
      "matching_enhanced_controls",
      "profile_customization",
      "discovery_priority",
      "boost_post",
      "boost_profile",
      "story_analytics",
      "marketplace_enhanced_visibility",
      "community_premium_tools",
      "media_limits_elevated",
      "ghc_earning_boost",
      "priority_support",
    ],
    mediaMaxPhotos: 12,
    mediaMaxStoryMb: 50,
    dailyBoosts: 3,
    /** Accelerates earning — not unlimited print */
    ghcDailyEarnMultiplier: 1.5,
    platformFeeDiscountPct: 10,
  },
  vvip: {
    id: "vvip",
    label: "VVIP",
    priceGhcMonthly: 500,
    priceGhcYearly: 4500,
    entitlements: [
      "badge_vvip",
      "badge_vip",
      "discovery_advanced_filters",
      "discovery_priority",
      "matching_enhanced_controls",
      "matching_advanced",
      "profile_customization",
      "profile_premium_presentation",
      "boost_post",
      "boost_profile",
      "story_analytics",
      "marketplace_enhanced_visibility",
      "marketplace_advanced_tools",
      "community_premium_tools",
      "community_advanced",
      "media_limits_elevated",
      "media_limits_max",
      "ghc_earning_boost",
      "ghc_earning_boost_high",
      "platform_fee_discount",
      "analytics_advanced",
      "creator_business_tools",
      "priority_support",
      "exclusive_experiences",
      "storage_elevated",
    ],
    mediaMaxPhotos: 24,
    mediaMaxStoryMb: 100,
    dailyBoosts: 10,
    /** Elite track — different access, not just VIP×2 numbers */
    ghcDailyEarnMultiplier: 2,
    platformFeeDiscountPct: 20,
  },
}

const STORAGE_KEY = "ghc_membership_v1"

const ACCOUNT_CACHE_KEY = "ghc_account_created_at_v1"

function readCachedAccountCreatedAt(userId: string): number | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined
    const raw = localStorage.getItem(ACCOUNT_CACHE_KEY)
    if (!raw) return undefined
    const all = JSON.parse(raw) as Record<string, number>
    const v = all[userId]
    return typeof v === "number" && Number.isFinite(v) ? v : undefined
  } catch {
    return undefined
  }
}

function writeCachedAccountCreatedAt(userId: string, ts: number) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(ACCOUNT_CACHE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    // Never overwrite with a different value — first write wins locally too
    if (all[userId] != null) return
    all[userId] = ts
    localStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

/** Best-effort hydrate from GET /api/economy/account when available */
export async function hydrateAccountCreatedAtFromServer(
  userId: string,
  authHeaders?: HeadersInit
): Promise<number | undefined> {
  const cached = readCachedAccountCreatedAt(userId)
  try {
    const res = await fetch("/api/economy/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeaders || {}),
      },
      body: JSON.stringify(cached != null ? {} : {}),
    })
    if (!res.ok) return cached
    const data = (await res.json()) as { accountCreatedAt?: number }
    if (data.accountCreatedAt != null && Number.isFinite(Number(data.accountCreatedAt))) {
      writeCachedAccountCreatedAt(userId, Number(data.accountCreatedAt))
      return Number(data.accountCreatedAt)
    }
  } catch {
    /* offline / studio */
  }
  return cached
}


/** New accounts: VVIP 24h → VIP 24h → Free. Derived from trialAnchorAt only. */
export const TRIAL_VVIP_MS = 24 * 60 * 60 * 1000
export const TRIAL_VIP_MS = 24 * 60 * 60 * 1000
export const TRIAL_TOTAL_MS = TRIAL_VVIP_MS + TRIAL_VIP_MS

export function tierFromTrialAnchor(trialAnchorAt: number, now = Date.now()): MembershipTierId {
  const age = Math.max(0, now - trialAnchorAt)
  if (age < TRIAL_VVIP_MS) return "vvip"
  if (age < TRIAL_TOTAL_MS) return "vip"
  return "free"
}


function loadStatus(userId: string): MembershipStatus {
  try {
    if (typeof localStorage === "undefined") {
      return { userId, tier: "free", active: true, source: "default", lifecycle: "standard" }
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { userId, tier: "free", active: true, source: "default", lifecycle: "standard" }
    const all = JSON.parse(raw) as Record<string, MembershipStatus>
    const s = all[userId]
    if (!s) return { userId, tier: "free", active: true, source: "default", lifecycle: "standard" }

    const now = Date.now()

    // Paid / admin / external membership takes precedence while unexpired
    if (
      s.lifecycle !== "trial" &&
      s.source &&
      s.source !== "default" &&
      s.source !== "trial" &&
      s.tier !== "free"
    ) {
      if (s.expiresAt && s.expiresAt < now) {
        // Fall through to trial if anchor exists, else free
        if (s.trialAnchorAt) {
          const tier = tierFromTrialAnchor(s.trialAnchorAt, now)
          return {
            userId,
            tier,
            active: true,
            startedAt: s.trialAnchorAt,
            trialAnchorAt: s.trialAnchorAt,
            source: tier === "free" ? "default" : "trial",
            lifecycle: tier === "free" ? "standard" : "trial",
          }
        }
        return { userId, tier: "free", active: true, source: "default", lifecycle: "standard" }
      }
      return s
    }

    // Trial lifecycle — recompute tier from fixed anchor (device-independent)
    if (s.trialAnchorAt || s.lifecycle === "trial" || s.source === "trial") {
      const anchor = s.trialAnchorAt || s.startedAt || now
      const tier = tierFromTrialAnchor(anchor, now)
      return {
        userId,
        tier,
        active: true,
        startedAt: anchor,
        trialAnchorAt: anchor,
        source: tier === "free" ? "default" : "trial",
        lifecycle: tier === "free" ? "standard" : "trial",
        expiresAt:
          tier === "vvip"
            ? anchor + TRIAL_VVIP_MS
            : tier === "vip"
              ? anchor + TRIAL_TOTAL_MS
              : undefined,
      }
    }

    if (s.expiresAt && s.expiresAt < now && s.tier !== "free") {
      return { userId, tier: "free", active: true, source: "default", lifecycle: "standard" }
    }
    return s
  } catch {
    return { userId, tier: "free", active: true, source: "default", lifecycle: "standard" }
  }
}

function saveStatus(status: MembershipStatus) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[status.userId] = status
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}


/**
 * Standalone status read for account spine / UI (no domain instance required).
 * Prefer createMembershipDomain().getStatus() inside mutation flows.
 */
export function getMembershipStatus(userId = "current-user"): MembershipStatus {
  return loadStatus(userId)
}

export function createMembershipDomain(deps: {
  currentUserId?: string
  /**
   * Account creation time (ms). Used once to anchor the VVIP→VIP→Free trial.
   * Must be stable across devices when provided by the backend profile.
   */
  getAccountCreatedAt?: () => number | undefined
  /** Optional spend callback for GHC purchase path (economy domain) */
  spendGhc?: (input: {
    amount: number
    reason: string
    sourceEvent: string
    referenceId?: string
  }) => Promise<{ ok: boolean; error?: string; txId?: string }>
}) {
  const userId = deps.currentUserId || "current-user"

  /**
   * Ensure trial membership for truly new accounts only.
   * Existing stored membership / older accounts are never reset into a new trial.
   */
  function ensureTrialLifecycle(): void {
    try {
      if (typeof localStorage === "undefined") return
      const raw = localStorage.getItem(STORAGE_KEY)
      const all = (raw ? JSON.parse(raw) : {}) as Record<string, MembershipStatus>
      if (all[userId]) return // already has a record — never reset

      const fromDeps = deps.getAccountCreatedAt?.()
      const fromCache = readCachedAccountCreatedAt(userId)
      const createdAt =
        (typeof fromCache === "number" && fromCache > 0 ? fromCache : undefined) ??
        (typeof fromDeps === "number" && fromDeps > 0 ? fromDeps : undefined)
      if (typeof fromDeps === "number" && fromDeps > 0) {
        writeCachedAccountCreatedAt(userId, fromDeps)
      }
      const now = Date.now()
      if (createdAt == null || !Number.isFinite(createdAt) || createdAt <= 0) {
        // Unknown account age — do not invent a trial
        all[userId] = { userId, tier: "free", active: true, source: "default", lifecycle: "standard" }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
        return
      }

      const age = now - createdAt
      if (age >= TRIAL_TOTAL_MS) {
        // Existing / returning user beyond trial window
        all[userId] = {
          userId,
          tier: "free",
          active: true,
          source: "default",
          lifecycle: "standard",
          trialAnchorAt: createdAt,
          startedAt: createdAt,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
        return
      }

      const tier = tierFromTrialAnchor(createdAt, now)
      all[userId] = {
        userId,
        tier,
        active: true,
        source: "trial",
        lifecycle: "trial",
        trialAnchorAt: createdAt,
        startedAt: createdAt,
        expiresAt: tier === "vvip" ? createdAt + TRIAL_VVIP_MS : createdAt + TRIAL_TOTAL_MS,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
      /* */
    }
  }

  function effectiveStatus(): MembershipStatus {
    ensureTrialLifecycle()
    return loadStatus(userId)
  }

  function planFor(tier: MembershipTierId): MembershipPlan {
    return MEMBERSHIP_PLANS[tier] || MEMBERSHIP_PLANS.free
  }

  return {
    getStatus(): MembershipStatus {
      return effectiveStatus()
    },

    getPlan(tier?: MembershipTierId): MembershipPlan {
      const t = tier || effectiveStatus().tier
      return planFor(t)
    },

    getCatalog(): MembershipPlan[] {
      return [MEMBERSHIP_PLANS.free, MEMBERSHIP_PLANS.vip, MEMBERSHIP_PLANS.vvip]
    },

    /** Single entitlement check for UI / domains */
    hasEntitlement(key: EntitlementKey, forUserId?: string): boolean {
      const status = forUserId ? loadStatus(forUserId) : effectiveStatus()
      if (!status.active) return false
      const plan = planFor(status.tier)
      return plan.entitlements.includes(key)
    },

    listEntitlements(forUserId?: string): EntitlementKey[] {
      const status = forUserId ? loadStatus(forUserId) : effectiveStatus()
      return [...planFor(status.tier).entitlements]
    },

    /** Media / boost limits derived from plan */
    getLimits(forUserId?: string) {
      const status = forUserId ? loadStatus(forUserId) : effectiveStatus()
      const plan = planFor(status.tier)
      return {
        mediaMaxPhotos: plan.mediaMaxPhotos,
        mediaMaxStoryMb: plan.mediaMaxStoryMb,
        dailyBoosts: plan.dailyBoosts,
        ghcDailyEarnMultiplier: plan.ghcDailyEarnMultiplier,
        platformFeeDiscountPct: plan.platformFeeDiscountPct,
      }
    },

    isVip(forUserId?: string): boolean {
      const t = (forUserId ? loadStatus(forUserId) : effectiveStatus()).tier
      return t === "vip" || t === "vvip"
    },

    isVvip(forUserId?: string): boolean {
      return (forUserId ? loadStatus(forUserId) : effectiveStatus()).tier === "vvip"
    },

    /**
     * Activate / change tier. Prefer external payment + this call, or GHC via purchaseWithGhc.
     */
    async activate(input: {
      tier: "vip" | "vvip"
      billingPeriod: "monthly" | "yearly" | "lifetime" | "comp"
      source?: MembershipStatus["source"]
      purchaseTxId?: string
      durationMs?: number
    }): Promise<MutationResult<{ status: MembershipStatus }>> {
      return runMutation({
        name: "membership.activate",
        actorId: userId,
        input,
        validate: (i) => {
          if (i.tier !== "vip" && i.tier !== "vvip") return "Invalid tier"
          return null
        },
        mutate: (i) => {
          const now = Date.now()
          const duration =
            i.durationMs ||
            (i.billingPeriod === "monthly"
              ? 30 * 86400000
              : i.billingPeriod === "yearly"
                ? 365 * 86400000
                : i.billingPeriod === "lifetime"
                  ? 100 * 365 * 86400000
                  : 30 * 86400000)
          const status: MembershipStatus = {
            userId,
            tier: i.tier,
            active: true,
            startedAt: now,
            expiresAt: i.billingPeriod === "comp" ? undefined : now + duration,
            billingPeriod: i.billingPeriod,
            lastPurchaseTxId: i.purchaseTxId,
            source: i.source || "external",
            lifecycle: "standard",
          }
          saveStatus(status)
          domainEvents.publish(
            i.tier === "vvip" ? "PREMIUM_ACTIVATED" : "PREMIUM_ACTIVATED",
            { planId: i.tier, tier: i.tier },
            userId,
            i.purchaseTxId
          )
          domainEvents.publish("PREMIUM_UPDATED", { tier: i.tier }, userId)
          return { status }
        },
      })
    },

    /** After Pi U2A completes — server grants entitlement; local cache updated on success */
    async activateFromExternalPayment(
      tier: "vip" | "vvip",
      billingPeriod: "monthly" | "yearly",
      payment: {
        provider: string
        paymentId: string
        txid: string
        intentId?: string
      }
    ): Promise<MutationResult<{ status: MembershipStatus }>> {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        try {
          const { IdentityService } = await import("@/lib/identity/identity-service")
          Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
        } catch { /* */ }
        const res = await fetch("/api/membership/activate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            tier,
            period: billingPeriod,
            method: "pi",
            intentId: payment.intentId,
            paymentId: payment.paymentId,
            txid: payment.txid,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.ok && data?.entitlement) {
          const e = data.entitlement
          return this.activate({
            tier: e.tier === "vvip" ? "vvip" : "vip",
            billingPeriod,
            source: "external",
            purchaseTxId: e.purchaseRef || `${payment.provider}:${payment.paymentId}:${payment.txid}`,
            durationMs:
              e.expiresAt && e.startedAt ? Math.max(0, e.expiresAt - e.startedAt) : undefined,
          })
        }
        // Server denied — do not grant locally
        if (res.status === 401 || res.status === 503) {
          // Offline / unauthenticated studio: fall back to local only with payment proof present
          if (payment.paymentId && payment.txid) {
            return this.activate({
              tier,
              billingPeriod,
              source: "external",
              purchaseTxId: `${payment.provider}:${payment.paymentId}:${payment.txid}`,
            })
          }
        }
        return {
          ok: false,
          error: data?.error || data?.message || "Server did not activate membership",
          phase: "authorize",
          requestId: payment.paymentId,
        }
      } catch {
        if (payment.paymentId && payment.txid) {
          return this.activate({
            tier,
            billingPeriod,
            source: "external",
            purchaseTxId: `${payment.provider}:${payment.paymentId}:${payment.txid}`,
          })
        }
        return {
          ok: false,
          error: "Activation failed",
          phase: "authorize",
          requestId: "local",
        }
      }
    },

    async purchaseWithGhc(
      tier: "vip" | "vvip",
      billingPeriod: "monthly" | "yearly" = "monthly"
    ): Promise<MutationResult<{ status: MembershipStatus }>> {
      const plan = planFor(tier)
      const price =
        billingPeriod === "yearly" ? plan.priceGhcYearly : plan.priceGhcMonthly
      if (price <= 0) {
        return { ok: false, error: "Invalid price", phase: "validate", requestId: "local" }
      }
      // Prefer server: spend + grant entitlement atomically from server catalog
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        try {
          const { IdentityService } = await import("@/lib/identity/identity-service")
          Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
        } catch { /* */ }
        const res = await fetch("/api/membership/activate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            tier,
            period: billingPeriod,
            method: "ghc",
            spendReferenceId: `membership_${tier}_${billingPeriod}_${userId}`,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.ok && data?.entitlement) {
          const e = data.entitlement
          return this.activate({
            tier: e.tier === "vvip" ? "vvip" : "vip",
            billingPeriod,
            source: "ghc",
            purchaseTxId: e.purchaseRef,
            durationMs:
              e.expiresAt && e.startedAt ? Math.max(0, e.expiresAt - e.startedAt) : undefined,
          })
        }
        if (res.status !== 503 && res.status !== 401 && data?.error) {
          return {
            ok: false,
            error: data.error || data.message || "Purchase failed",
            phase: "authorize",
            requestId: "server",
          }
        }
      } catch {
        /* fall through to local spend */
      }
      if (!deps.spendGhc) {
        return { ok: false, error: "GHC spend not available", phase: "authorize", requestId: "local" }
      }
      const paid = await deps.spendGhc({
        amount: price,
        reason: `${plan.label} ${billingPeriod}`,
        sourceEvent: "PREMIUM_PURCHASE",
        referenceId: `${tier}_${billingPeriod}`,
      })
      if (!paid.ok) {
        return { ok: false, error: paid.error || "Payment failed", phase: "authorize", requestId: "local" }
      }
      return this.activate({
        tier,
        billingPeriod,
        source: "ghc",
        purchaseTxId: paid.txId,
      })
    },

    async cancel(): Promise<MutationResult<{ status: MembershipStatus }>> {
      return runMutation({
        name: "membership.cancel",
        actorId: userId,
        input: {},
        mutate: () => {
          const prev = loadStatus(userId)
          const status: MembershipStatus = {
            userId,
            tier: "free",
            active: true,
            source: "default",
            lifecycle: "standard",
            trialAnchorAt: prev.trialAnchorAt,
          }
          saveStatus(status)
          domainEvents.publish("PREMIUM_EXPIRED", { tier: "free" }, userId)
          return { status }
        },
      })
    },

    /**
     * Permission-engine bridge: map membership to legacy MembershipTier-ish value.
     * Verification remains independent.
     */
    toPermissionMembership(): "free" | "premium" {
      const t = effectiveStatus().tier
      return t === "vip" || t === "vvip" ? "premium" : "free"
    },
  }
}

export type MembershipDomain = ReturnType<typeof createMembershipDomain>
