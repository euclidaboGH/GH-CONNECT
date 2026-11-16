/**
 * Canonical cross-surface correlation envelope for GreenHaven economic activity.
 * Financial authority remains the ledger/RPC that created the transaction; this
 * module only enriches an already-authoritative row so Wallet, Activity Center,
 * Notifications and Creator/Profile surfaces resolve the same durable object.
 */
import { readGhcServerEnv } from "./env"
import { supabaseRpc, supabaseRest } from "@/lib/server/supabase/rest-client"

export type GhCorrelationKind =
  | "social" | "community" | "marketplace" | "membership"
  | "transfer" | "reward" | "payment" | "creator_tip" | "system"

export type GhCorrelationEnvelope = {
  version: 1
  kind: GhCorrelationKind
  event: string
  occurredAt: string
  postId?: string
  commentId?: string
  communityId?: string
  listingId?: string
  orderId?: string
  rewardId?: string
  paymentId?: string
  tipIntentId?: string
  counterpartyId?: string
  requestId?: string
}

const value = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : undefined

export function buildCorrelationEnvelope(input: Omit<GhCorrelationEnvelope, "version" | "occurredAt"> & { occurredAt?: string }): GhCorrelationEnvelope {
  return {
    version: 1,
    kind: input.kind,
    event: String(input.event || "UNKNOWN").trim().toUpperCase(),
    occurredAt: input.occurredAt || new Date().toISOString(),
    ...(value(input.postId) ? { postId: value(input.postId) } : {}),
    ...(value(input.commentId) ? { commentId: value(input.commentId) } : {}),
    ...(value(input.communityId) ? { communityId: value(input.communityId) } : {}),
    ...(value(input.listingId) ? { listingId: value(input.listingId) } : {}),
    ...(value(input.orderId) ? { orderId: value(input.orderId) } : {}),
    ...(value(input.rewardId) ? { rewardId: value(input.rewardId) } : {}),
    ...(value(input.paymentId) ? { paymentId: value(input.paymentId) } : {}),
    ...(value(input.tipIntentId) ? { tipIntentId: value(input.tipIntentId) } : {}),
    ...(value(input.counterpartyId) ? { counterpartyId: value(input.counterpartyId) } : {}),
    ...(value(input.requestId) ? { requestId: value(input.requestId) } : {}),
  }
}

/** Best-effort enrichment. Never converts a failed economic mutation into success. */
export async function attachLedgerCorrelation(input: {
  userId: string
  referenceId: string
  envelope: GhCorrelationEnvelope
}): Promise<boolean> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !input.userId || !input.referenceId) return false
  try {
    const res = await (async () => { const r = await supabaseRpc('ghc_attach_transaction_correlation', typeof JSON.stringify({ p_user_id: input.userId === "string" ? JSON.parse(JSON.stringify({ p_user_id: input.userId) : JSON.stringify({ p_user_id: input.userId, { timeoutMs: 15000 }); return { ok: r.ok, status: r.status, json: async () => r.ok ? r.data : r.body, text: async () => JSON.stringify(r.ok ? r.data : r.body) }; })(),
      cache: "no-store",
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => null) as { ok?: boolean } | null
    return data?.ok === true
  } catch { return false }
}
