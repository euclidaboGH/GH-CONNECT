import { createHash, randomUUID } from "node:crypto"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkRateLimit as localRateLimit, type RateLimitResult } from "@/lib/server/economy/rate-limit"

type DurableRateLimit = { ok?: boolean; remaining?: number; retryAfterSec?: number }

function hashKey(key: string): string {
  return createHash("sha256").update(String(key).slice(0, 512), "utf8").digest("hex")
}

async function rpc(name: string, body: Record<string, unknown>): Promise<unknown | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch { return null }
}

export async function checkDurableRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options: { onUnavailable?: "local" | "deny" } = {},
): Promise<RateLimitResult> {
  const result = await rpc("gh_security_rate_limit_consume", {
    p_bucket_key: hashKey(key), p_limit: limit, p_window_ms: windowMs,
  }) as DurableRateLimit | null
  if (result && typeof result.ok === "boolean") {
    return result.ok
      ? { ok: true, remaining: Number(result.remaining || 0) }
      : { ok: false, retryAfterSec: Math.max(1, Number(result.retryAfterSec || 1)) }
  }
  // Authentication and other abuse-sensitive entry points can opt into a
  // fail-closed policy. A local fallback is not equivalent to a durable limit
  // in a multi-instance deployment and must never be presented as such.
  if (options.onUnavailable === "deny") {
    return { ok: false, retryAfterSec: 5 }
  }
  return localRateLimit(key, limit, windowMs)
}

export async function appendSecurityEvent(input: {
  eventType: string
  outcome: "allowed" | "blocked" | "challenged" | "error"
  reasonCode?: string
  actorUserId?: string
  targetUserId?: string
  resourceType?: string
  resourceId?: string
  requestId?: string
  correlationId?: string
  metadata?: Record<string, unknown>
  expiresAt?: string
}): Promise<void> {
  // Deliberately fire-and-forget: security telemetry must never turn a valid
  // product request into a 5xx response when the telemetry store is degraded.
  void rpc("gh_security_event_append", {
    p_event_type: input.eventType,
    p_outcome: input.outcome,
    p_reason_code: input.reasonCode ?? null,
    p_actor_user_id: input.actorUserId ?? null,
    p_target_user_id: input.targetUserId ?? null,
    p_resource_type: input.resourceType ?? null,
    p_resource_id: input.resourceId ?? null,
    p_request_id: input.requestId ?? null,
    p_correlation_id: input.correlationId ?? null,
    p_metadata: input.metadata ?? {},
    p_expires_at: input.expiresAt ?? null,
  })
}

export function requestCorrelationId(request: Request): string {
  const supplied = request.headers.get("x-request-id") || request.headers.get("x-correlation-id") || ""
  if (/^[A-Za-z0-9._:-]{8,160}$/.test(supplied)) return supplied
  return `req_${randomUUID()}`
}
