import { readGhcServerEnv } from "@/lib/server/economy/env"
import { curationRedistributeEnabled as unlockCuration } from "@/lib/server/economy/testnet-unlock"

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
}): Promise<{ ok: boolean; credited?: boolean; amount?: number; error?: string; reason?: string }> {
  if (!curationRedistributeEnabled()) {
    return { ok: false, error: "CURATION_REDISTRIBUTE_DISABLED" }
  }
  const e = readGhcServerEnv()
  if (!e.supabaseUrl || !e.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(`${e.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_curation_redistribute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: e.supabaseServiceRoleKey,
        Authorization: `Bearer ${e.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_voter_id: input.voterId,
        p_author_id: input.authorId,
        p_post_id: input.postId,
        p_amount: input.amount,
        p_reference_id: input.referenceId,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: String(data?.error || "RPC_FAILED") }
    }
    return {
      ok: true,
      credited: Boolean(data.credited),
      amount: data.amount != null ? Number(data.amount) : undefined,
      reason: data.reason ? String(data.reason) : undefined,
    }
  } catch {
    return { ok: false, error: "RPC_FAILED" }
  }
}
