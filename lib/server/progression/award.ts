import { readGhcServerEnv } from "@/lib/server/economy/env"

export type ProgressionAwardInput = {
  userId: string
  eventType: "profile_completed" | "original_post_published" | "helpful_reply_verified" | "community_contribution_verified" | "marketplace_order_completed" | "learning_milestone"
  xp: number
  idempotencyKey: string
  sourceRef?: string
  metadata?: Record<string, unknown>
}

/** Server-only award helper. Call only after the source action is durably verified. */
export async function awardProgressionXp(input: ProgressionAwardInput): Promise<{ ok: boolean; duplicate?: boolean; totalXp?: number; error?: string }> {
  if (process.env.GHC_PROGRESSION_PAUSED === "1") return { ok: false, error: "PROGRESSION_PAUSED" }
  const userId = String(input.userId || "").trim()
  const key = String(input.idempotencyKey || "").trim()
  if (!userId || !key || !Number.isInteger(input.xp) || input.xp < 0 || input.xp > 10000) return { ok: false, error: "INVALID_INPUT" }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "DATABASE_UNAVAILABLE" }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_progression_award_xp`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_user_id: userId, p_event_type: input.eventType, p_xp: input.xp, p_idempotency_key: key, p_source_ref: input.sourceRef ?? null, p_rules_version: "progression-v1", p_metadata: input.metadata ?? {} }), cache: "no-store",
    })
    const data = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !data || data.ok !== true) return { ok: false, error: String(data?.error || "XP_AWARD_FAILED") }
    return { ok: true, duplicate: Boolean(data.duplicate), totalXp: Number(data.totalXp) || 0 }
  } catch { return { ok: false, error: "XP_AWARD_FAILED" } }
}
