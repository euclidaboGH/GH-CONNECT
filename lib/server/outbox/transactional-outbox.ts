/**
 * Server-only transport for the Phase I PostgreSQL transactional outbox.
 * The paired SQL proposal must be installed before enabling this worker.
 * Business mutations must enqueue through gh_outbox_enqueue INSIDE their own
 * SECURITY DEFINER transaction; this module must never enqueue after a write.
 */
import { hasPrivilegedDatabase, readGhcServerEnv } from "@/lib/server/economy/env"

export type OutboxEvent = {
  event_id: string
  aggregate_type: string
  aggregate_id: string
  event_type: string
  payload: Record<string, unknown>
  idempotency_key: string
  attempts: number
  max_attempts: number
  lease_token: string
  lease_expires_at: string
}

export type OutboxHandler = (event: OutboxEvent) => Promise<void>

type RpcResult<T> = { ok: true; data: T } | { ok: false; code: string }

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<RpcResult<T>> {
  const env = readGhcServerEnv()
  if (!hasPrivilegedDatabase(env) || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, code: "OUTBOX_DATABASE_UNAVAILABLE" }
  }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return { ok: false, code: `OUTBOX_RPC_${response.status}` }
    return { ok: true, data: (await response.json()) as T }
  } catch {
    return { ok: false, code: "OUTBOX_RPC_UNAVAILABLE" }
  }
}

export async function claimOutboxBatch(input: { limit?: number; leaseSeconds?: number } = {}) {
  const limit = input.limit ?? 25
  const leaseSeconds = input.leaseSeconds ?? 60
  if (!Number.isInteger(limit) || limit < 1 || limit > 100
    || !Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 900) {
    return { ok: false as const, code: "OUTBOX_INVALID_CLAIM", events: [] as OutboxEvent[] }
  }
  const result = await rpc<OutboxEvent[]>("gh_outbox_claim", {
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  })
  if (!result.ok || !Array.isArray(result.data)) {
    return { ok: false as const, code: result.ok ? "OUTBOX_INVALID_RESPONSE" : result.code, events: [] as OutboxEvent[] }
  }
  return { ok: true as const, events: result.data }
}

export async function heartbeatOutboxLease(event: Pick<OutboxEvent, "event_id" | "lease_token">, leaseSeconds = 60) {
  if (!event.event_id || !event.lease_token || !Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 900) return false
  const result = await rpc<boolean>("gh_outbox_heartbeat", {
    p_event_id: event.event_id,
    p_lease_token: event.lease_token,
    p_lease_seconds: leaseSeconds,
  })
  return result.ok && result.data === true
}

export async function acknowledgeOutboxEvent(event: Pick<OutboxEvent, "event_id" | "lease_token">) {
  if (!event.event_id || !event.lease_token) return false
  const result = await rpc<boolean>("gh_outbox_ack", {
    p_event_id: event.event_id,
    p_lease_token: event.lease_token,
  })
  return result.ok && result.data === true
}

export async function failOutboxEvent(
  event: Pick<OutboxEvent, "event_id" | "lease_token">,
  errorCode: string,
) {
  if (!event.event_id || !event.lease_token) return "INVALID_EVENT" as const
  const safeCode = String(errorCode || "DELIVERY_FAILED").replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80)
  const result = await rpc<string>("gh_outbox_fail", {
    p_event_id: event.event_id,
    p_lease_token: event.lease_token,
    p_error_code: safeCode,
  })
  return result.ok ? result.data : "RPC_UNAVAILABLE" as const
}

/**
 * At-least-once delivery. Handlers MUST be idempotent using event_id or
 * idempotency_key; an external side effect can succeed before ack is lost.
 */
export async function runOutboxBatch(handlers: Record<string, OutboxHandler>, limit = 25) {
  const claimed = await claimOutboxBatch({ limit })
  if (!claimed.ok) return { ok: false as const, code: claimed.code, claimed: 0, published: 0, retried: 0, dead: 0 }
  let published = 0
  let retried = 0
  let dead = 0
  for (const event of claimed.events) {
    try {
      const handler = handlers[event.event_type]
      if (!handler) throw Object.assign(new Error("NO_HANDLER"), { code: "NO_HANDLER" })
      await handler(event)
      if (await acknowledgeOutboxEvent(event)) published++
      else retried++ // lease lost; do not attempt a stale ack or mutate state
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code || "DELIVERY_FAILED")
        : "DELIVERY_FAILED"
      const result = await failOutboxEvent(event, code)
      if (result === "DEAD") dead++
      else if (result === "RETRY") retried++
      else retried++ // includes lease loss; next claim/recovery resolves it
    }
  }
  return { ok: true as const, claimed: claimed.events.length, published, retried, dead }
}

/** Operator-only wrapper. Do not expose this through a user-facing API route. */
export async function replayDeadLetterEvent(eventId: string, operatorId: string, reason: string) {
  const normalized = String(eventId || "").trim()
  const actor = String(operatorId || "").trim()
  const note = String(reason || "").trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    || !actor || actor.length > 128 || note.length < 3 || note.length > 500) return false
  const result = await rpc<boolean>("gh_outbox_replay", { p_event_id: normalized, p_operator_id: actor, p_reason: note })
  return result.ok && result.data === true
}
