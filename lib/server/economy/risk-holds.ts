import { readGhcServerEnv } from "@/lib/server/economy/env"
import { enqueueDomainEvent } from "@/lib/server/domain-events/outbox"

export async function recordRewardRiskHold(input: {
  userId: string
  sourceEventId: string
  reasons: string[]
  sourceEvent: string
}): Promise<void> {
  const userId = String(input.userId || "").trim()
  const sourceEventId = String(input.sourceEventId || "").trim()
  if (!userId || !sourceEventId || !input.reasons.length) return
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
  const reasons = input.reasons.slice(0, 12).map((x) => String(x).slice(0, 80))
  const reasonCode = reasons.some((r) => r.includes("VELOCITY"))
    ? "velocity"
    : reasons.some((r) => r.includes("SELF_TARGET") || r.includes("RECIPROCAL"))
      ? "self_dealing"
      : reasons.some((r) => r.includes("SUSPICIOUS") || r.includes("BOT"))
        ? "sybil_suspected"
        : "policy_limit"
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_reward_risk_holds?on_conflict=user_id%2Csource_event_id`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ user_id: userId, source_event_id: sourceEventId, reason_code: reasonCode, metadata: { sourceEvent: input.sourceEvent.slice(0, 80), reasons } }),
    })
    if (!response.ok) return
    void enqueueDomainEvent({
      eventType: "reward.held",
      idempotencyKey: `reward.hold:${userId}:${sourceEventId}`,
      aggregateType: "reward_risk_hold",
      aggregateId: `${userId}:${sourceEventId}`,
      actorId: userId,
      payload: { userId, sourceEventId, reasonCode, reasons },
    })
  } catch {
    // Reward denial remains safe if audit persistence is temporarily unavailable.
  }
}
