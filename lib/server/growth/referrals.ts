import { readGhcServerEnv } from "@/lib/server/economy/env"

export type ReferralQualificationEvent = "profile_verified" | "first_original_post" | "retained_7d" | "completed_marketplace_order"

/** Call only after the server has durably verified the referred user's milestone. */
export async function qualifyGrowthReferral(input: {
  referredUserId: string
  event: ReferralQualificationEvent
  evidenceRef: string
}): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const userId = String(input.referredUserId || "").trim()
  const evidenceRef = String(input.evidenceRef || "").trim()
  if (!userId || !evidenceRef) return { ok: false, error: "EVIDENCE_REQUIRED" }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "DATABASE_UNAVAILABLE" }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_growth_referral_qualify`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_referred_user_id: userId, p_qualification_event: input.event, p_evidence_ref: evidenceRef }), cache: "no-store",
    })
    const data = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !data || data.ok !== true) return { ok: false, error: String(data?.error || "REFERRAL_QUALIFICATION_FAILED") }
    return { ok: true, duplicate: Boolean(data.duplicate) }
  } catch { return { ok: false, error: "REFERRAL_QUALIFICATION_FAILED" } }
}
