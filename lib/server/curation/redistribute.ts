import { curationRedistributeEnabled as unlockCuration } from "@/lib/server/economy/testnet-unlock"
import { supabaseRpc } from "@/lib/server/supabase/rest-client"

export function curationRedistributeEnabled(): boolean {
  return process.env.GHC_CURATION_REDISTRIBUTE_V2_ENABLED === "true" && unlockCuration()
}

const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/

/** Balance-funded curation transfer. Never mints GHC. */
export async function redistributeCurationReward(input: {
  voterId: string
  authorId: string
  postId: string
  amount: number
  referenceId: string
}): Promise<{
  ok: boolean
  credited?: boolean
  amount?: number
  error?: string
  reason?: string
  availableBalanceAfter?: number
  requiredBalance?: number
  contentRewardRecorded?: boolean
}> {
  if (!curationRedistributeEnabled()) return { ok: false, error: "CURATION_REDISTRIBUTE_DISABLED" }
  const voterId = String(input.voterId || "").trim()
  const authorId = String(input.authorId || "").trim()
  const postId = String(input.postId || "").trim()
  const referenceId = String(input.referenceId || "").trim()
  const amount = Number(input.amount)
  if (!SAFE_ID.test(voterId) || !SAFE_ID.test(authorId) || !SAFE_ID.test(postId)
    || !SAFE_ID.test(referenceId) || referenceId.length < 8 || voterId === authorId
    || !Number.isFinite(amount) || amount <= 0 || amount > 1
    || Math.abs(amount * 10_000 - Math.round(amount * 10_000)) > 1e-7) {
    return { ok: false, error: "INVALID_CURATION_REDISTRIBUTION_INPUT" }
  }
  const result = await supabaseRpc<Record<string, unknown>>("ghc_curation_redistribute_v2", {
    p_voter_id: voterId,
    p_author_id: authorId,
    p_post_id: postId,
    p_amount: amount,
    p_reference_id: referenceId,
  }, { timeoutMs: 8_000 })
  if (!result.ok) {
    return { ok: false, error: result.error === "SUPABASE_NOT_CONFIGURED" ? "SERVER_UNAVAILABLE" : "RPC_FAILED" }
  }
  const data = result.data
  if (!data || data.ok !== true) return { ok: false, error: String(data?.error || "RPC_FAILED") }
  const credited = data.credited === true
  const returnedAmount = data.amount == null ? null : Number(data.amount)
  const balance = data.availableBalanceAfter == null ? null : Number(data.availableBalanceAfter)
  const required = data.requiredBalance == null ? null : Number(data.requiredBalance)
  if (credited && (returnedAmount === null || !Number.isFinite(returnedAmount) || returnedAmount <= 0 || returnedAmount > 1
    || (balance !== null && (!Number.isFinite(balance) || balance < 0))
    || (required !== null && (!Number.isFinite(required) || required < 0)))) {
    return { ok: false, error: "CURATION_REDISTRIBUTION_RESPONSE_INVALID" }
  }
  if (data.requestAmountMismatch === true) {
    return { ok: false, error: "CURATION_REDISTRIBUTION_IDEMPOTENCY_AMOUNT_MISMATCH" }
  }
  return {
    ok: true,
    credited,
    amount: returnedAmount ?? undefined,
    reason: data.reason ? String(data.reason) : undefined,
    availableBalanceAfter: balance ?? undefined,
    requiredBalance: required ?? undefined,
    contentRewardRecorded: Boolean(data.contentRewardRecorded || data.contentRewardProjected),
  }
}
