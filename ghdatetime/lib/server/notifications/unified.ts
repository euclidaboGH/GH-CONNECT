import { readGhcServerEnv } from "@/lib/server/economy/env"

export type UnifiedNotificationRow = {
  id: string
  recipientUserId: string
  actorUserId?: string | null
  sourceType: string
  sourceId?: string | null
  type: string
  title: string
  body: string
  metadata: Record<string, unknown>
  correlationId?: string | null
  requestId?: string | null
  readAt?: string | null
  createdAt: string
  expiresAt?: string | null
}

async function rpc(name: string, body: Record<string, unknown>) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, data: null as any, error: "DB_UNAVAILABLE" }
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
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, data, error: `HTTP_${res.status}` }
    return { ok: data?.ok !== false, data, error: data?.error ? String(data.error) : undefined }
  } catch {
    return { ok: false, data: null as any, error: "RPC_FAILED" }
  }
}

export async function listUnifiedNotifications(userId: string, opts?: {
  limit?: number
  beforeCreatedAt?: string | null
  beforeId?: string | null
  unreadOnly?: boolean
}) {
  return rpc("gh_notification_inbox_list", {
    p_recipient_user_id: userId,
    p_limit: Math.min(Math.max(opts?.limit ?? 60, 1), 100),
    p_before_created_at: opts?.beforeCreatedAt ?? null,
    p_before_id: opts?.beforeId ?? null,
    p_unread_only: Boolean(opts?.unreadOnly),
  })
}

export async function unifiedUnreadCount(userId: string) {
  return rpc("gh_notification_inbox_unread_count", { p_recipient_user_id: userId })
}

export async function markUnifiedNotificationsRead(userId: string, opts: { ids?: string[]; all?: boolean }) {
  return rpc("gh_notification_inbox_mark_read", {
    p_recipient_user_id: userId,
    p_ids: opts.ids?.slice(0, 100) ?? null,
    p_all: Boolean(opts.all),
  })
}

export async function appendRealtimeEvent(input: {
  eventId: string
  recipientUserId: string
  actorUserId?: string | null
  eventType: string
  aggregateType?: string
  aggregateId?: string | null
  correlationId?: string | null
  requestId?: string | null
  payload?: Record<string, unknown>
  expiresAt?: string | null
}) {
  return rpc("gh_notification_event_append", {
    p_event_id: input.eventId,
    p_recipient_user_id: input.recipientUserId,
    p_actor_user_id: input.actorUserId ?? null,
    p_event_type: input.eventType,
    p_aggregate_type: input.aggregateType ?? "system",
    p_aggregate_id: input.aggregateId ?? null,
    p_correlation_id: input.correlationId ?? null,
    p_request_id: input.requestId ?? null,
    p_payload: input.payload ?? {},
    p_expires_at: input.expiresAt ?? null,
  })
}
