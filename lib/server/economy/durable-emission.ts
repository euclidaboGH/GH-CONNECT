/**
 * P0 multi-instance durable activity windows + global demand.
 * Memory path is Studio/test only when DB is not configured.
 */
import { hasPrivilegedDatabase, readGhcServerEnv } from "@/lib/server/economy/env"
import { isDatabaseConfigured } from "@/lib/server/economy/http"

async function rpc<T = unknown>(fn: string, body: Record<string, unknown>): Promise<T | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify(body),
      }
    )
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function durableGetGlobalDemand(dayKey: string): Promise<number | null> {
  if (!isDatabaseConfigured()) return null
  const n = await rpc<number>("ghc_get_global_demand", { p_day_key: dayKey })
  return typeof n === "number" ? n : n == null ? null : Number(n) || 0
}

export async function durableRecordGlobalDemand(
  dayKey: string,
  amountGhc: number
): Promise<number | null> {
  if (!isDatabaseConfigured()) return null
  const n = await rpc<number>("ghc_record_global_demand", {
    p_day_key: dayKey,
    p_amount: amountGhc,
  })
  return typeof n === "number" ? n : n == null ? null : Number(n) || 0
}

export type DurableActivityGrant = {
  ok: boolean
  granted: number
  dayRemaining: number
  weekRemaining: number
  error?: string
}

export async function durableTryActivityGrant(input: {
  userId: string
  dayKey: string
  weekKey: string
  requested: number
  dailyCap: number
  weeklyCap: number
}): Promise<DurableActivityGrant | null> {
  if (!isDatabaseConfigured()) return null
  const data = await rpc<Record<string, unknown>>("ghc_activity_try_grant", {
    p_user_id: input.userId,
    p_day_key: input.dayKey,
    p_week_key: input.weekKey,
    p_requested: input.requested,
    p_daily_cap: input.dailyCap,
    p_weekly_cap: input.weeklyCap,
  })
  if (!data || data.ok === false) {
    return data
      ? {
          ok: false,
          granted: 0,
          dayRemaining: 0,
          weekRemaining: 0,
          error: String(data.error || "ACTIVITY_GRANT_FAILED"),
        }
      : null
  }
  return {
    ok: true,
    granted: Number(data.granted) || 0,
    dayRemaining: Number(data.dayRemaining) || 0,
    weekRemaining: Number(data.weekRemaining) || 0,
  }
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
