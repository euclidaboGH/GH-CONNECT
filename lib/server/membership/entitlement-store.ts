/**
 * Server-authoritative membership entitlements.
 * DATABASE is production authority. Memory is cache / Studio-only fallback.
 * FREE | VIP | VVIP — never trust client "I am VIP".
 */

import { durableMembershipUpsert } from "@/lib/server/economy/durable-emission"
import { hasPrivilegedDatabase, readGhcServerEnv } from "@/lib/server/economy/env"
import { isDatabaseConfigured, allowMemoryServer } from "@/lib/server/economy/http"

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

/** Test helper — clears process cache only */
export function clearMembershipCacheForTests(): void {
  map().clear()
}

const PERIOD_MS: Record<string, number> = {
  monthly: 30 * 86400000,
  yearly: 365 * 86400000,
  comp: 30 * 86400000,
}

/** Catalog prices — must match commerce / membership-domain / economic-config */
export const MEMBERSHIP_SERVER_CATALOG = {
  vip: { monthlyGhc: 150, yearlyGhc: 1500, monthlyPi: 1.5, yearlyPi: 15 },
  vvip: { monthlyGhc: 300, yearlyGhc: 3000, monthlyPi: 3, yearlyPi: 30 },
} as const

function defaultFree(userId: string): ServerMembershipEntitlement {
  return {
    userId,
    tier: "free",
    active: true,
    startedAt: Date.now(),
    source: "default",
    updatedAt: Date.now(),
    audit: [{ at: Date.now(), action: "DEFAULT_FREE" }],
  }
}

function applyExpiry(existing: ServerMembershipEntitlement): ServerMembershipEntitlement {
  if (
    existing.tier !== "free" &&
    existing.expiresAt &&
    existing.expiresAt < Date.now()
  ) {
    return {
      ...existing,
      tier: "free",
      active: true,
      source: "default",
      updatedAt: Date.now(),
      audit: [
        ...(existing.audit || []),
        { at: Date.now(), action: "EXPIRED", detail: existing.tier },
      ].slice(-40),
    }
  }
  return existing
}

function rowToEntitlement(row: Record<string, unknown>, userId: string): ServerMembershipEntitlement {
  const started =
    typeof row.started_at === "string"
      ? Date.parse(row.started_at)
      : Number(row.startedAt) || Date.now()
  const expiresRaw = row.expires_at ?? row.expiresAt
  const expiresAt =
    expiresRaw == null || expiresRaw === ""
      ? undefined
      : typeof expiresRaw === "string"
        ? Date.parse(expiresRaw)
        : Number(expiresRaw)
  const audit = Array.isArray(row.audit) ? (row.audit as ServerMembershipEntitlement["audit"]) : []
  return applyExpiry({
    userId,
    tier: (String(row.tier || "free") as MembershipTier) || "free",
    active: row.active !== false,
    startedAt: started,
    expiresAt: Number.isFinite(expiresAt as number) ? (expiresAt as number) : undefined,
    billingPeriod: (row.billing_period || row.billingPeriod) as BillingPeriod | undefined,
    source: (String(row.source || "default") as MembershipSource) || "default",
    purchaseRef: (row.purchase_ref || row.purchaseRef) as string | undefined,
    paymentIntentId: (row.payment_intent_id || row.paymentIntentId) as string | undefined,
    updatedAt: row.updated_at
      ? Date.parse(String(row.updated_at))
      : Date.now(),
    audit,
  })
}

/**
 * Load membership from database (authoritative).
 * Returns null if DB not configured or row missing / error.
 */
export async function loadEntitlementFromDb(
  userId: string
): Promise<ServerMembershipEntitlement | null> {
  if (!hasPrivilegedDatabase(readGhcServerEnv())) return null
  const env = readGhcServerEnv()
  try {
    const url = `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1/ghc_membership_entitlements?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey!,
        Authorization: `Bearer ${env.supabaseServiceRoleKey!}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Record<string, unknown>[]
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rowToEntitlement(rows[0], userId)
  } catch {
    return null
  }
}

/**
 * Authoritative membership read.
 * Production + DB: database only (memory is cache after successful load).
 * Production + no DB: fail closed as free only if memory mode forbidden; else Studio memory.
 */
export async function getEntitlementAuthoritative(
  userId: string
): Promise<ServerMembershipEntitlement> {
  if (isDatabaseConfigured()) {
    const fromDb = await loadEntitlementFromDb(userId)
    if (fromDb) {
      map().set(userId, fromDb)
      return fromDb
    }
    // No row yet → free; do not invent paid tier from memory
    const cached = map().get(userId)
    if (cached && cached.tier !== "free" && cached.purchaseRef) {
      // Stale paid cache without DB row is unsafe — drop to free in production authority
      const free = defaultFree(userId)
      map().set(userId, free)
      return free
    }
    const free = defaultFree(userId)
    map().set(userId, free)
    return free
  }

  // No DB: Studio/test memory only
  if (!allowMemoryServer()) {
    return defaultFree(userId)
  }
  return getEntitlement(userId)
}

/**
 * Sync helper for non-async call sites — memory cache only.
 * Prefer getEntitlementAuthoritative in API routes.
 */
export function getEntitlement(userId: string): ServerMembershipEntitlement {
  const existing = map().get(userId)
  if (!existing) {
    const fresh = defaultFree(userId)
    map().set(userId, fresh)
    return fresh
  }
  const next = applyExpiry(existing)
  if (next !== existing) map().set(userId, next)
  return next
}

export async function grantEntitlement(input: {
  userId: string
  tier: "vip" | "vvip"
  billingPeriod: BillingPeriod
  source: MembershipSource
  purchaseRef: string
  paymentIntentId?: string
}): Promise<ServerMembershipEntitlement> {
  const now = Date.now()
  const prev = await getEntitlementAuthoritative(input.userId)
  if (prev.purchaseRef === input.purchaseRef && prev.tier === input.tier && prev.active) {
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

  if (isDatabaseConfigured()) {
    const ok = await durableMembershipUpsert({
      userId: next.userId,
      tier: next.tier,
      active: next.active,
      startedAt: next.startedAt,
      expiresAt: next.expiresAt,
      billingPeriod: next.billingPeriod,
      source: next.source,
      purchaseRef: next.purchaseRef,
      paymentIntentId: next.paymentIntentId,
      audit: next.audit,
    })
    if (!ok) {
      throw new Error("MEMBERSHIP_DURABLE_WRITE_FAILED")
    }
  } else if (!allowMemoryServer()) {
    throw new Error("MEMBERSHIP_STORE_UNAVAILABLE")
  }

  map().set(input.userId, next)
  return next
}

/**
 * Server-authoritative membership grant from a COMPLETED/FULFILLED Pi payment intent.
 * Called from payment complete/fulfill so entitlement does not depend on the client
 * surviving to call /api/membership/activate after the Pi flow.
 *
 * Never grants from CREATED/APPROVED/pending intents.
 * Tier + period come only from durable intent metadata.productId (catalog id).
 * Idempotent via purchaseRef.
 */
export async function tryGrantMembershipFromCompletedIntent(input: {
  userId: string
  intent: {
    id: string
    userId: string
    purpose?: string
    status: string
    amount: number
    currency?: string
    providerPaymentId?: string | null
    metadata?: Record<string, unknown> | null
  }
}): Promise<{
  granted: boolean
  entitlement?: ServerMembershipEntitlement
  error?: string
  skipped?: boolean
}> {
  const { userId, intent } = input
  if (!intent || intent.userId !== userId) {
    return { granted: false, error: "FORBIDDEN" }
  }
  if (intent.status !== "COMPLETED" && intent.status !== "FULFILLED") {
    return { granted: false, error: "PAYMENT_NOT_COMPLETED" }
  }
  if (intent.currency && intent.currency !== "PI") {
    return { granted: false, error: "CURRENCY_MISMATCH", skipped: true }
  }

  const purpose = String(intent.purpose || intent.metadata?.purpose || "")
  const productId = String(intent.metadata?.productId || "").toLowerCase()
  if (purpose !== "membership" && !productId.startsWith("membership_")) {
    return { granted: false, skipped: true }
  }

  let tier: "vip" | "vvip" | null = null
  let period: BillingPeriod | null = null
  if (productId === "membership_vip_monthly") {
    tier = "vip"
    period = "monthly"
  } else if (productId === "membership_vip_yearly") {
    tier = "vip"
    period = "yearly"
  } else if (productId === "membership_vvip_monthly") {
    tier = "vvip"
    period = "monthly"
  } else if (productId === "membership_vvip_yearly") {
    tier = "vvip"
    period = "yearly"
  } else {
    const mTier = String(
      intent.metadata?.tier || intent.metadata?.membershipTier || ""
    ).toLowerCase()
    const mPeriod = String(
      intent.metadata?.period || intent.metadata?.billingPeriod || ""
    ).toLowerCase()
    if (
      (mTier === "vip" || mTier === "vvip") &&
      (mPeriod === "monthly" || mPeriod === "yearly")
    ) {
      tier = mTier
      period = mPeriod
    }
  }

  if (!tier || !period) {
    return { granted: false, error: "PRODUCT_MISMATCH", skipped: true }
  }

  const catalog = MEMBERSHIP_SERVER_CATALOG[tier]
  const expectedPi = period === "yearly" ? catalog.yearlyPi : catalog.monthlyPi
  if (Math.abs(Number(intent.amount) - expectedPi) > 0.001) {
    return { granted: false, error: "amount_mismatch" }
  }

  if (productId && productId !== `membership_${tier}_${period}`) {
    return { granted: false, error: "PRODUCT_MISMATCH" }
  }

  const purchaseRef =
    (intent.providerPaymentId && String(intent.providerPaymentId)) ||
    `pi:${intent.id}`

  try {
    const entitlement = await grantEntitlement({
      userId,
      tier,
      billingPeriod: period,
      source: "pi",
      purchaseRef,
      paymentIntentId: intent.id,
    })
    return { granted: true, entitlement }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MEMBERSHIP_DURABLE_WRITE_FAILED"
    return { granted: false, error: msg }
  }
}
