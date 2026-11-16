/**
 * Durable ad verification event recording — never grants rewards.
 */
import { supabaseRpc } from "@/lib/server/supabase/rest-client"

export async function recordAdVerificationAttempt(input: {
  userId: string
  adId: string
  idempotencyKey: string
  placement?: string
  status: "rejected" | "disabled" | "pending" | "duplicate"
  rejectReason?: string
  metadata?: Record<string, unknown>
}): Promise<{
  ok: boolean
  duplicate?: boolean
  eventId?: string
  error?: string
}> {
  const result = await supabaseRpc<Record<string, unknown>>("gh_ad_verification_record", {
    p_user_id: input.userId,
    p_ad_id: input.adId,
    p_idempotency_key: input.idempotencyKey,
    p_placement: input.placement || "rewarded",
    p_status: input.status,
    p_reject_reason: input.rejectReason || null,
    p_metadata: input.metadata || {},
  })
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === "SUPABASE_NOT_CONFIGURED" ? "DB_UNAVAILABLE" : result.error,
    }
  }
  const data = result.data
  if (!data || data.ok === false) {
    return {
      ok: false,
      error: String((data && (data.error || data.message)) || "RPC_FAILED"),
    }
  }
  return {
    ok: true,
    duplicate: Boolean(data.duplicate),
    eventId: String(data.eventId || ""),
  }
}
