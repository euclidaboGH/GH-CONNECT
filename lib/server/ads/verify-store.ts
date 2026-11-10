/**
 * Durable ad verification event recording — never grants rewards.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

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
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "DB_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_ad_verification_record`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_user_id: input.userId,
          p_ad_id: input.adId,
          p_idempotency_key: input.idempotencyKey,
          p_placement: input.placement || "rewarded",
          p_status: input.status,
          p_reject_reason: input.rejectReason || null,
          p_metadata: input.metadata || {},
        }),
        cache: "no-store",
      }
    )
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || !data || data.ok === false) {
      return {
        ok: false,
        error: String((data && (data.error || data.message)) || `HTTP_${res.status}`),
      }
    }
    return {
      ok: true,
      duplicate: Boolean(data.duplicate),
      eventId: String(data.eventId || ""),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "RPC_FAILED" }
  }
}
