/**
 * Phase 9 — Platform utility & charity accounting (server-only).
 * Segregated from user withdrawable earnings. Fees and charity never mint available PI.
 */
import { hasPrivilegedDatabase } from "@/lib/server/economy/env"
import { supabaseRpc } from "@/lib/server/supabase/rest-client"

async function rpc<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<T | null> {
  if (!hasPrivilegedDatabase()) return null
  const result = await supabaseRpc<T>(name, body, { timeoutMs: 12_000 })
  if (!result.ok) return null
  return result.data
}

/** Record the 3% withdrawal fee as platform utility (not user credit). */
export async function postWithdrawalFee(input: {
  userId: string
  feeAtomic: number
  payoutRequestId: string
  uniqueRef?: string
}): Promise<{ ok: boolean; duplicate?: boolean; entryId?: string; error?: string }> {
  if (!Number.isInteger(input.feeAtomic) || input.feeAtomic <= 0) {
    return { ok: false, error: "INVALID_FEE" }
  }
  const result = await rpc<{
    ok?: boolean
    duplicate?: boolean
    entryId?: string
    error?: string
  }>("gh_platform_utility_post", {
    p_entry_kind: "withdrawal_fee",
    p_amount_atomic: input.feeAtomic,
    p_unique_ref: input.uniqueRef || `withdrawal_fee:${input.payoutRequestId}`,
    p_related_user_id: input.userId,
    p_source_table: "gh_earnings_ledger_entries",
    p_source_id: input.payoutRequestId,
    p_payout_request_id: input.payoutRequestId,
    p_reason: "withdrawal_fee_3pct",
    p_metadata: { feeBps: 300 },
  })
  if (!result) return { ok: false, error: "PLATFORM_LEDGER_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "FEE_POST_FAILED") }
  return { ok: true, duplicate: result.duplicate === true, entryId: result.entryId }
}

export async function recordCharityContribution(input: {
  userId: string
  amountAtomic: number
  uniqueRef: string
  campaignKey?: string
  reason?: string
}): Promise<{ ok: boolean; duplicate?: boolean; contributionId?: string; error?: string }> {
  const result = await rpc<{
    ok?: boolean
    duplicate?: boolean
    contributionId?: string
    error?: string
  }>("gh_charity_record_contribution", {
    p_user_id: input.userId,
    p_amount_atomic: input.amountAtomic,
    p_unique_ref: input.uniqueRef,
    p_campaign_key: input.campaignKey || "general",
    p_reason: input.reason || "charity_contribution",
    p_metadata: {},
  })
  if (!result) return { ok: false, error: "CHARITY_LEDGER_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "CHARITY_RECORD_FAILED") }
  return { ok: true, duplicate: result.duplicate === true, contributionId: result.contributionId }
}

export async function getCharityUserSummary(userId: string) {
  return rpc<{
    ok?: boolean
    totalAtomic?: number | string
    total?: number
    contributionCount?: number
    items?: unknown[]
    error?: string
  }>("gh_charity_user_summary", { p_user_id: userId })
}

export async function getPlatformUtilitySummary() {
  return rpc<{
    ok?: boolean
    byKind?: unknown[]
    error?: string
  }>("gh_platform_utility_summary", {})
}
