/**
 * Reputation store — service-role RPCs only.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"
import {
  isReputationEventType,
  pointsForEvent,
  progressTowardNext,
  type ReputationEventType,
} from "@/lib/server/reputation/config"

async function rpc(
  fn: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "DB_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    )
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) {
      return {
        ok: false,
        error: String(
          (data && (data.message || data.error)) || `HTTP_${res.status}`
        ),
      }
    }
    return { ok: true, data: data || {} }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "RPC_FAILED" }
  }
}

export async function getReputationState(userId: string) {
  const result = await rpc("gh_reputation_get", { p_user_id: userId })
  if (!result.ok || !result.data) {
    return { ok: false as const, error: result.error || "GET_FAILED" }
  }
  if (result.data.ok === false) {
    return { ok: false as const, error: String(result.data.error || "GET_FAILED") }
  }
  const totalPoints = Number(result.data.totalPoints ?? 0)
  const progress = progressTowardNext(totalPoints)
  return {
    ok: true as const,
    userId: String(result.data.userId || userId),
    totalPoints,
    level: Number(result.data.level ?? progress.level.level),
    levelName: progress.level.name,
    levelId: progress.level.id,
    eventCount: Number(result.data.eventCount ?? 0),
    updatedAt: result.data.updatedAt ?? null,
    nextLevel: progress.next
      ? { level: progress.next.level, name: progress.next.name, minPoints: progress.next.minPoints }
      : null,
    pointsToNext: progress.pointsToNext,
    progressRatio: progress.progressRatio,
    sustainabilityGate: progress.level.sustainabilityGate,
  }
}

/**
 * Apply a catalog event. Points always from server config (not caller).
 * manual_adjustment_credit is blocked here — privileged tools only later.
 */
export async function applyReputationEvent(input: {
  userId: string
  eventType: string
  idempotencyKey: string
  sourceRef?: string
  metadata?: Record<string, unknown>
}) {
  if (!isReputationEventType(input.eventType)) {
    return { ok: false as const, error: "INVALID_EVENT_TYPE" }
  }
  const type = input.eventType as ReputationEventType
  if (type === "manual_adjustment_credit") {
    return { ok: false as const, error: "FORBIDDEN_EVENT" }
  }
  const points = pointsForEvent(type)
  if (points <= 0) {
    return { ok: false as const, error: "INVALID_POINTS" }
  }

  const result = await rpc("gh_reputation_apply_event", {
    p_user_id: input.userId,
    p_event_type: type,
    p_points: points,
    p_idempotency_key: input.idempotencyKey,
    p_source_ref: input.sourceRef ?? null,
    p_metadata: input.metadata ?? {},
  })

  if (!result.ok || !result.data) {
    return { ok: false as const, error: result.error || "APPLY_FAILED" }
  }
  if (result.data.ok === false) {
    return { ok: false as const, error: String(result.data.error || "APPLY_FAILED") }
  }

  const totalPoints = Number(result.data.totalPoints ?? 0)
  const progress = progressTowardNext(totalPoints)
  return {
    ok: true as const,
    duplicate: Boolean(result.data.duplicate),
    eventId: String(result.data.eventId || ""),
    totalPoints,
    level: Number(result.data.level ?? progress.level.level),
    levelName: progress.level.name,
    eventCount: Number(result.data.eventCount ?? 0),
  }
}
