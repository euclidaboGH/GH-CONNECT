import { addCalendarMonths, getMembershipGhcPrice, getMembershipPiPrice } from "@/lib/membership-pricing"
/**
 * Server-authoritative membership entitlements.
 * DATABASE is production authority. Memory is cache / Studio-only fallback.
 * FREE | VIP | VVIP — never trust client "I am VIP".
 */

import { durableMembershipUpsert } from "@/lib/server/economy/durable-emission"
import { hasPrivilegedDatabase, readGhcServerEnv } from "@/lib/server/economy/env"
import { isDatabaseConfigured, allowMemoryServer } from "@/lib/server/economy/http"
import { listIntentsForUserAsync } from "@/lib/server/payments/intent-store"
import type { PaymentIntent } from "@/lib/server/payments/intent-types"

export type MembershipTier = "free" | "vip" | "vvip"
export type BillingPeriod = "monthly" | "four_months" | "eight_months" | "yearly" | "comp"
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

const ACCESS_MONTHS: Record<string, number> = {
  monthly: 2,
  four_months: 5,
  eight_months: 9,
  yearly: 13,
  comp: 1,
}

/** Catalog prices — must match commerce / membership-domain / economic-config */
export const MEMBERSHIP_SERVER_CATALOG = {
  vip: {
    monthlyGhc: getMembershipGhcPrice("vip", 1).chargeGhc, fourMonthsGhc: getMembershipGhcPrice("vip", 4).chargeGhc, eightMonthsGhc: getMembershipGhcPrice("vip", 8).chargeGhc, yearlyGhc: getMembershipGhcPrice("vip", 12).chargeGhc,
    monthlyPi: getMembershipPiPrice("vip", 1).chargePi, fourMonthsPi: getMembershipPiPrice("vip", 4).chargePi, eightMonthsPi: getMembershipPiPrice("vip", 8).chargePi, yearlyPi: getMembershipPiPrice("vip", 12).chargePi,
  },
  vvip: {
    monthlyGhc: getMembershipGhcPrice("vvip", 1).chargeGhc, fourMonthsGhc: getMembershipGhcPrice("vvip", 4).chargeGhc, eightMonthsGhc: getMembershipGhcPrice("vvip", 8).chargeGhc, yearlyGhc: getMembershipGhcPrice("vvip", 12).chargeGhc,
    monthlyPi: getMembershipPiPrice("vvip", 1).chargePi, fourMonthsPi: getMembershipPiPrice("vvip", 4).chargePi, eightMonthsPi: getMembershipPiPrice("vvip", 8).chargePi, yearlyPi: getMembershipPiPrice("vvip", 12).chargePi,
  },
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

export type EntitlementLoadResult =
  | { ok: true; entitlement: ServerMembershipEntitlement; source: "db" | "default" | "memory" }
  | { ok: false; error: "MEMBERSHIP_STORE_UNAVAILABLE" }

/**
 * Load membership from database (authoritative).
 * Distinguishes: row found | confirmed absent | store error.
 */
export async function loadEntitlementFromDb(
  userId: string
): Promise<
  | { ok: true; entitlement: ServerMembershipEntitlement | null }
  | { ok: false; error: "MEMBERSHIP_STORE_UNAVAILABLE" }
> {
  if (!hasPrivilegedDatabase(readGhcServerEnv())) {
    return { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE" }
  }
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
    // Table missing / network / RLS misconfig → unavailable (not "free")
    if (res.status === 404 || res.status === 503 || res.status >= 500) {
      return { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE" }
    }
    if (!res.ok) {
      // 401/403/PGRST... treat as store unavailable for membership authority
      return { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE" }
    }
    const rows = (await res.json()) as Record<string, unknown>[]
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: true, entitlement: null }
    }
    return { ok: true, entitlement: rowToEntitlement(rows[0], userId) }
  } catch {
    return { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE" }
  }
}

/**
 * Authoritative membership read.
 * Missing row in a healthy store → free.
 * Store unavailable → throws so API can return 503 (not fake free).
 */
export async function getEntitlementAuthoritative(
  userId: string
): Promise<ServerMembershipEntitlement> {
  const result = await tryGetEntitlementAuthoritative(userId)
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.entitlement
}

/** Non-throwing authoritative read for routes that need 503 vs free. */
export async function tryGetEntitlementAuthoritative(
  userId: string
): Promise<EntitlementLoadResult> {
  if (isDatabaseConfigured()) {
    const fromDb = await loadEntitlementFromDb(userId)
    if (!fromDb.ok) return fromDb
    if (fromDb.entitlement) {
      map().set(userId, fromDb.entitlement)
      return { ok: true, entitlement: fromDb.entitlement, source: "db" }
    }
    // Confirmed no row → free (do not use stale paid cache)
    const free = defaultFree(userId)
    map().set(userId, free)
    return { ok: true, entitlement: free, source: "default" }
  }

  if (!allowMemoryServer()) {
    return { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE" }
  }
  return { ok: true, entitlement: getEntitlement(userId), source: "memory" }
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

/**
 * Recover a membership entitlement from the durable payment-intent history.
 * This is intentionally server-selected: callers cannot choose an intent, tier,
 * amount, or purchase reference. Only a verified COMPLETED/FULFILLED membership
 * intent can be converted into an entitlement, and an already-active paid
 * entitlement is never replaced by an older or different purchase.
 */
export async function reconcileMembershipFromPaymentHistory(userId: string): Promise<{
  ok: boolean
  recovered: boolean
  entitlement?: ServerMembershipEntitlement
  intentId?: string
  error?: string
}> {
  const uid = String(userId || '').trim()
  if (!uid) return { ok: false, recovered: false, error: 'INVALID_USER' }

  const current = await tryGetEntitlementAuthoritative(uid)
  if (!current.ok) return { ok: false, recovered: false, error: current.error }
  if (current.entitlement.tier !== 'free' && current.entitlement.active &&
      (!current.entitlement.expiresAt || current.entitlement.expiresAt > Date.now())) {
    return { ok: true, recovered: false, entitlement: current.entitlement }
  }

  let intents: PaymentIntent[]
  try {
    intents = await listIntentsForUserAsync(uid)
  } catch {
    return { ok: false, recovered: false, error: 'PAYMENT_INTENT_STORE_UNAVAILABLE' }
  }

  const candidates = intents
    .filter((intent) => intent.userId === uid && (intent.status === 'COMPLETED' || intent.status === 'FULFILLED'))
    .filter((intent) => intent.currency === 'PI')
    .filter((intent) => {
      const productId = String(intent.metadata?.productId || '').toLowerCase()
      return intent.purpose === 'membership' || /^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$/.test(productId)
    })
    .sort((a, b) => (b.completedAt || b.fulfilledAt || b.createdAt) - (a.completedAt || a.fulfilledAt || a.createdAt))

  for (const intent of candidates) {
    const result = await tryGrantMembershipFromCompletedIntent({
      userId: uid,
      intent: {
        id: intent.id,
        userId: intent.userId,
        purpose: intent.purpose,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        providerPaymentId: intent.providerPaymentId,
        metadata: intent.metadata,
      },
    })
    if (result.granted && result.entitlement) {
      return { ok: true, recovered: true, entitlement: result.entitlement, intentId: intent.id }
    }
  }

  return { ok: true, recovered: false, entitlement: current.entitlement }
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
  const prevResult = await tryGetEntitlementAuthoritative(input.userId)
  if (!prevResult.ok) {
    throw new Error("MEMBERSHIP_STORE_UNAVAILABLE")
  }
  const prev = prevResult.entitlement
  if (prev.purchaseRef === input.purchaseRef && prev.tier === input.tier && prev.active) {
    return prev
  }
  const accessMonths = ACCESS_MONTHS[input.billingPeriod] || ACCESS_MONTHS.monthly
  const next: ServerMembershipEntitlement = {
    userId: input.userId,
    tier: input.tier,
    active: true,
    startedAt: now,
    expiresAt: input.billingPeriod === "comp" ? undefined : addCalendarMonths(now, accessMonths),
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
  const productMatch = productId.match(/^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$/)
  if (productMatch) {
    tier = productMatch[1] as "vip" | "vvip"
    period = productMatch[2] as BillingPeriod
  } else {
    const mTier = String(intent.metadata?.tier || intent.metadata?.membershipTier || "").toLowerCase()
    const mPeriod = String(intent.metadata?.period || intent.metadata?.billingPeriod || "").toLowerCase()
    if ((mTier === "vip" || mTier === "vvip") && (["monthly", "four_months", "eight_months", "yearly"].includes(mPeriod))) {
      tier = mTier
      period = mPeriod as BillingPeriod
    }
  }

  if (!tier || !period) {
    return { granted: false, error: "PRODUCT_MISMATCH", skipped: true }
  }

  const catalog = MEMBERSHIP_SERVER_CATALOG[tier]
  const expectedPi = period === "yearly" ? catalog.yearlyPi : period === "eight_months" ? catalog.eightMonthsPi : period === "four_months" ? catalog.fourMonthsPi : catalog.monthlyPi
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


/** Ops: list spend posts that look like membership without matching purchase_ref. */
export async function listOrphanMembershipPurchaseCandidates(
  limit = 50
): Promise<{ ok: boolean; candidates: unknown[]; error?: string }> {
  const { isDatabaseConfigured } = await import("@/lib/server/economy/http")
  if (!isDatabaseConfigured()) return { ok: false, candidates: [], error: "DB_NOT_CONFIGURED" }
  const { readGhcServerEnv } = await import("@/lib/server/economy/env")
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, candidates: [], error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_membership_list_orphan_purchase_candidates`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({ p_limit: limit }),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, candidates: [], error: String(data?.error || "LIST_FAILED") }
    }
    return { ok: true, candidates: Array.isArray(data.candidates) ? data.candidates : [] }
  } catch {
    return { ok: false, candidates: [], error: "RPC_FAILED" }
  }
}

/**
 * Ops: complete entitlement when ledger debit already exists for reference.
 * Never executes a new spend.
 */
export async function completeOrphanedMembershipPurchase(input: {
  userId: string
  referenceId: string
  row: Record<string, unknown>
  operatorNote?: string
}): Promise<{ ok: boolean; error?: string; idempotent?: boolean }> {
  const { isDatabaseConfigured } = await import("@/lib/server/economy/http")
  if (!isDatabaseConfigured()) return { ok: false, error: "DB_NOT_CONFIGURED" }
  const { readGhcServerEnv } = await import("@/lib/server/economy/env")
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_membership_complete_orphaned_purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_user_id: input.userId,
          p_reference_id: input.referenceId,
          p_row: input.row,
          p_operator_note: (input.operatorNote || "ops_orphan_entitlement_complete").slice(0, 160),
        }),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: String(data?.error || "RECONCILE_FAILED") }
    }
    return { ok: true, idempotent: Boolean(data.idempotent) }
  } catch {
    return { ok: false, error: "RPC_FAILED" }
  }
}
