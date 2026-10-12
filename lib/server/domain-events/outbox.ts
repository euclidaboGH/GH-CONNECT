import { readGhcServerEnv } from "@/lib/server/economy/env"

export type DomainEventInput = {
  eventType: string
  idempotencyKey: string
  aggregateType: string
  aggregateId: string
  actorId?: string
  payload?: Record<string, unknown>
  schemaVersion?: number
}

/** Enqueue a versioned idempotent event. Use inside a SQL transaction when possible. */
export async function enqueueDomainEvent(input: DomainEventInput): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "DATABASE_UNAVAILABLE" }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_domain_event_enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_event_type: input.eventType,
        p_idempotency_key: input.idempotencyKey,
        p_aggregate_type: input.aggregateType,
        p_aggregate_id: input.aggregateId,
        p_actor_id: input.actorId ?? null,
        p_payload: input.payload ?? {},
        p_schema_version: input.schemaVersion ?? 1,
      }),
      cache: "no-store",
    })
    const data = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !data || data.ok !== true) return { ok: false, error: String(data?.error || "OUTBOX_ENQUEUE_FAILED") }
    return { ok: true, eventId: data.eventId == null ? undefined : String(data.eventId) }
  } catch {
    return { ok: false, error: "OUTBOX_ENQUEUE_FAILED" }
  }
}
