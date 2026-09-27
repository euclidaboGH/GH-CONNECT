/**
 * Durable social notifications — informational only.
 * Never credits GHC/Pi or mutates ledger/membership.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

export type SocialNotificationType =
  | "follow"
  | "post_like"
  | "post_comment"
  | "comment_reply"
  | "curation"
  | "mention"
  | "share"

async function rpc(name: string, body: Record<string, unknown>): Promise<{
  ok: boolean
  data: Record<string, unknown> | null
  error?: string
}> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, data: null, error: "DB_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`,
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
      return { ok: false, data, error: `HTTP_${res.status}` }
    }
    if (data && data.ok === false) {
      return { ok: false, data, error: String(data.error || "RPC_REJECTED") }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : "RPC_FAILED" }
  }
}

/** Fire-and-forget safe: never throws into social mutation success path. */
export async function emitSocialNotification(input: {
  recipientUserId: string
  actorUserId: string
  type: SocialNotificationType
  entityType: "none" | "user" | "post" | "comment"
  entityId?: string
  title: string
  body: string
  dedupeKey: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  if (!input.recipientUserId || !input.dedupeKey) return
  if (input.recipientUserId === input.actorUserId) return
  await rpc("gh_social_notification_create", {
    p_recipient_id: input.recipientUserId,
    p_actor_id: input.actorUserId,
    p_type: input.type,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId || null,
    p_title: input.title,
    p_body: input.body,
    p_dedupe_key: input.dedupeKey,
    p_metadata: input.metadata || {},
  }).catch(() => null)
}

export async function listSocialNotifications(
  recipientUserId: string,
  opts?: { limit?: number; beforeMs?: number | null; unreadOnly?: boolean }
) {
  return rpc("gh_social_notifications_list", {
    p_recipient_id: recipientUserId,
    p_limit: opts?.limit ?? 40,
    p_before_ms: opts?.beforeMs ?? null,
    p_unread_only: Boolean(opts?.unreadOnly),
  })
}

export async function socialUnreadCount(recipientUserId: string) {
  return rpc("gh_social_notifications_unread_count", {
    p_recipient_id: recipientUserId,
  })
}

export async function markSocialNotificationsRead(
  recipientUserId: string,
  opts: { ids?: string[]; all?: boolean }
) {
  return rpc("gh_social_notifications_mark_read", {
    p_recipient_id: recipientUserId,
    p_ids: opts.ids || null,
    p_all: Boolean(opts.all),
  })
}

/** Resolve post author for like/comment notifications — session actor must not supply author. */
export async function lookupPostAuthor(postId: string): Promise<string | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !postId) return null
  try {
    const url = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts`)
    url.searchParams.set("id", `eq.${postId}`)
    url.searchParams.set("select", "author_id,deleted_at")
    url.searchParams.set("limit", "1")
    const res = await fetch(url.toString(), {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    })
    const rows = (await res.json().catch(() => [])) as Array<{
      author_id?: string
      deleted_at?: string | null
    }>
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row || row.deleted_at) return null
    return row.author_id ? String(row.author_id) : null
  } catch {
    return null
  }
}
