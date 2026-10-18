/**
 * Referral programme server helpers.
 * Settlement requires GHC_REFERRAL_SETTLEMENT_ENABLED=1 and issuance guard migration applied.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

function env() {
  return readGhcServerEnv()
}

function settlementEnabled(): boolean {
  return String(process.env.GHC_REFERRAL_SETTLEMENT_ENABLED || "").trim() === "1"
}

async function rpc(name: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const e = env()
  if (!e.supabaseUrl || !e.supabaseServiceRoleKey) return null
  try {
    const res = await fetch(`${e.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: e.supabaseServiceRoleKey,
        Authorization: `Bearer ${e.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: String(data?.message || data?.error || res.status) }
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function ensureReferralCode(userId: string) {
  const data = await rpc("ghc_referral_ensure_code", { p_user_id: userId })
  if (!data || data.ok !== true) return { ok: false as const, error: String(data?.error || "RPC_FAILED") }
  return { ok: true as const, code: String(data.code), createdAt: data.createdAt }
}

export async function attributeReferral(referredUserId: string, code: string) {
  const data = await rpc("ghc_referral_attribute", {
    p_referred_user_id: referredUserId,
    p_code: code,
  })
  if (!data || data.ok !== true) return { ok: false as const, error: String(data?.error || "RPC_FAILED") }
  return {
    ok: true as const,
    referrerUserId: data.referrerUserId ? String(data.referrerUserId) : undefined,
    idempotent: Boolean(data.idempotent),
  }
}

/** Queue 5% reward after verified VIP GHC membership charge. */
export async function queueReferralReward(input: {
  referredUserId: string
  membershipReferenceId: string
  chargedGhc: number
}) {
  const data = await rpc("ghc_referral_queue_reward", {
    p_referred_user_id: input.referredUserId,
    p_membership_reference_id: input.membershipReferenceId,
    p_charged_ghc: input.chargedGhc,
  })
  if (!data || data.ok !== true) return { ok: false as const, error: String(data?.error || "RPC_FAILED") }
  return {
    ok: true as const,
    queued: Boolean(data.queued),
    rewardId: data.rewardId ? String(data.rewardId) : undefined,
    rewardGhc: data.rewardGhc != null ? Number(data.rewardGhc) : undefined,
    reason: data.reason ? String(data.reason) : undefined,
  }
}

/** Post pending reward to ledger — only when settlement flag enabled. */
export async function settleReferralReward(rewardId: string) {
  if (!settlementEnabled()) {
    return { ok: false as const, error: "REFERRAL_SETTLEMENT_DISABLED" }
  }
  const data = await rpc("ghc_settle_referral_reward", { p_reward_id: rewardId })
  if (!data || data.ok !== true) return { ok: false as const, error: String(data?.error || "RPC_FAILED") }
  return {
    ok: true as const,
    idempotent: Boolean(data.idempotent),
    ledgerReferenceId: data.ledgerReferenceId ? String(data.ledgerReferenceId) : undefined,
    rewardGhc: data.rewardGhc != null ? Number(data.rewardGhc) : undefined,
  }
}

export function isReferralSettlementEnabled() {
  return settlementEnabled()
}
