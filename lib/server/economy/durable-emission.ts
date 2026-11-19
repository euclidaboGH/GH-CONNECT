/**
 * P0 multi-instance durable activity windows + global demand.
 * Memory path is Studio/test only when DB is not configured.
 */
import { hasPrivilegedDatabase, readGhcServerEnv } from "@/lib/server/economy/env"
import { isDatabaseConfigured } from "@/lib/server/economy/http"
import { supabaseRpc } from "@/lib/server/supabase/rest-client"

async function rpc<T = unknown>(fn: string, body: Record<string, unknown>): Promise<T | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const res = await (async () => { const r = await supabaseRpc(fn, body, { timeoutMs: 15000 }); return { ok: r.ok, status: r.status, json: async () => r.ok ? r.data : r.body, text: async () => JSON.stringify(r.ok ? r.data : r.body) }; })()
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export type DurableActivityEmission = {
  ok: boolean
  baseGhc: number
  grantedGhc: number
  m: number
  g: number
  dayRemaining: number
  weekRemaining: number
  demandAfter: number
  budget: number
  error?: string
}

/** One SQL transaction reserves user caps and global demand together. */
export async function durableTryActivityEmission(input: {
  userId: string
  dayKey: string
  weekKey: string
  requested: number
  dailyCap: number
  weeklyCap: number
  eligibleEconomicUsers: number
}): Promise<DurableActivityEmission | null> {
  if (!isDatabaseConfigured()) return null
  if (!Number.isSafeInteger(input.eligibleEconomicUsers) || input.eligibleEconomicUsers < 1) return null
  const data = await rpc<Record<string, unknown>>("ghc_activity_try_emission_v2", {
    p_user_id: input.userId,
    p_day_key: input.dayKey,
    p_week_key: input.weekKey,
    p_requested: input.requested,
    p_daily_cap: input.dailyCap,
    p_weekly_cap: input.weeklyCap,
    p_eligible_users: input.eligibleEconomicUsers,
  })
  if (!data || data.ok !== true) {
    return data ? {
      ok: false, baseGhc: 0, grantedGhc: 0, m: 0, g: 0,
      dayRemaining: 0, weekRemaining: 0, demandAfter: 0, budget: 0,
      error: String(data.error || "ACTIVITY_EMISSION_FAILED"),
    } : null
  }
  const values = [data.baseGhc, data.grantedGhc, data.m, data.g, data.dayRemaining, data.weekRemaining, data.demandAfter, data.budget]
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return { ok: false, baseGhc: 0, grantedGhc: 0, m: 0, g: 0, dayRemaining: 0, weekRemaining: 0, demandAfter: 0, budget: 0, error: "ACTIVITY_EMISSION_RESPONSE_INVALID" }
  }
  const [baseGhc, grantedGhc, m, g, dayRemaining, weekRemaining, demandAfter, budget] = values as number[]
  const curveN = Math.max(10, input.eligibleEconomicUsers)
  const expectedM = Math.max(0.18, Math.min(1, 0.18 + 0.82 / Math.pow(1 + 0.2 * (Math.log(curveN / 10) / Math.log(10)), 1.15)))
  const expectedBudget = 8 * Math.pow(input.eligibleEconomicUsers, 0.85)
  const expectedG = demandAfter > 0 ? Math.max(0, Math.min(1, expectedBudget / demandAfter)) : 1
  const expectedGross = Math.round(baseGhc * expectedM * expectedG * 1_000_000) / 1_000_000
  if (baseGhc <= 0 || baseGhc > input.requested || baseGhc > input.dailyCap || grantedGhc <= 0 || grantedGhc > baseGhc || m < 0 || m > 1 || g < 0 || g > 1
    || Math.abs(m - expectedM) > 1e-9 || Math.abs(g - expectedG) > 1e-9
    || Math.abs(budget - expectedBudget) > 1e-6 || Math.abs(grantedGhc - expectedGross) > 0.000002
    || dayRemaining < 0 || dayRemaining > input.dailyCap || weekRemaining < 0 || weekRemaining > input.weeklyCap
    || demandAfter < 0 || budget <= 0) {
    return { ok: false, baseGhc: 0, grantedGhc: 0, m: 0, g: 0, dayRemaining: 0, weekRemaining: 0, demandAfter: 0, budget: 0, error: "ACTIVITY_EMISSION_RESPONSE_INVALID" }
  }
  return { ok: true, baseGhc, grantedGhc, m, g, dayRemaining, weekRemaining, demandAfter, budget }
}

export async function durableMembershipUpsert(row: {
  userId: string
  tier: string
  active: boolean
  startedAt: number
  expiresAt?: number
  billingPeriod?: string
  source: string
  purchaseRef?: string
  paymentIntentId?: string
  audit?: unknown[]
}): Promise<boolean> {
  if (!hasPrivilegedDatabase(readGhcServerEnv())) return false
  const payload = {
    user_id: row.userId,
    tier: row.tier,
    active: row.active,
    started_at: new Date(row.startedAt).toISOString(),
    expires_at: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    billing_period: row.billingPeriod || null,
    source: row.source,
    purchase_ref: row.purchaseRef || null,
    payment_intent_id: row.paymentIntentId || null,
    audit: row.audit || [],
  }
  const data = await rpc<{ ok?: boolean }>("ghc_membership_upsert", { p_row: payload })
  return Boolean(data && data.ok !== false)
}
