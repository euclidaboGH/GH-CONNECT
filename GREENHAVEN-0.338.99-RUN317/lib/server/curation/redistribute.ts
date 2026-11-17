import { curationRedistributeEnabled as unlockCuration } from "@/lib/server/economy/testnet-unlock"
import { supabaseRpc } from "@/lib/server/supabase/rest-client"

export function curationRedistributeEnabled(): boolean {
  return unlockCuration()
}

/**
 * Balance-funded curation contribution: debit voter, credit author, same amount.
 * Cap 1 GHC per call at SQL layer; app may pass lower amounts.
 */
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
  if (!curationRedistributeEnabled()) {
    return { ok: false, error: "CURATION_REDISTRIBUTE_DISABLED" }
  }
  const result = await supabaseRpc<Record<string, unknown>>("ghc_curation_redistribute", {
    p_voter_id: input.voterId,
    p_author_id: input.authorId,
    p_post_id: input.postId,
    p_amount: input.amount,
    p_reference_id: input.referenceId,
  })
  if (!result.ok) {
    return { ok: false, error: result.error === "SUPABASE_NOT_CONFIGURED" ? "SERVER_UNAVAILABLE" : "RPC_FAILED" }
  }
  const data = result.data
  if (!data || data.ok !== true) {
    return { ok: false, error: String(data?.error || "RPC_FAILED") }
  }
  return {
    ok: true,
    credited: Boolean(data.credited),
    amount: data.amount != null ? Number(data.amount) : undefined,
    reason: data.reason ? String(data.reason) : undefined,
    availableBalanceAfter: data.availableBalanceAfter != null ? Number(data.availableBalanceAfter) : undefined,
    requiredBalance: data.requiredBalance != null ? Number(data.requiredBalance) : undefined,
    contentRewardRecorded: Boolean(data.contentRewardRecorded || data.contentRewardProjected),
  }
}
