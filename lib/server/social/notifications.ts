/**
 * Durable social notifications — informational only.
 * Never credits GHC/Pi or mutates ledger/membership.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { buildCorrelationEnvelope } from "@/lib/server/economy/correlation"

export type SocialNotificationType =
  | "follow"
  | "connection"
  | "connection_request"
  | "connection_accept"
  | "friend_request"
  | "post_created"
  | "post_like"
  | "post_comment"
  | "comment_reply"
  | "curation"
  | "mention"
  | "share"
  | "reputation_level_up"
  | "marketplace_listing"
  | "marketplace_order"
  | "marketplace_comment"
  | "community_join"
  | "community_invite"
  | "system"

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
    p_metadata: {
      ...(input.metadata || {}),
      correlation: buildCorrelationEnvelope({
        kind: input.metadata?.communityId ? "community" : "social",
        event: input.type,
        postId: String(input.metadata?.postId || (input.entityType === "post" ? input.entityId || "" : "")) || undefined,
        commentId: String(input.metadata?.commentId || (input.entityType === "comment" ? input.entityId || "" : "")) || undefined,
        communityId: input.metadata?.communityId ? String(input.metadata.communityId) : undefined,
        counterpartyId: input.actorUserId,
      }),
    },
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

/** Resolve recent participants on a post or the exact reply thread, without trusting client-supplied recipients. */
export async function lookupCommentThreadParticipants(
  postId: string,
  parentId: string | null | undefined,
  actorUserId: string,
  limit = 24,
): Promise<{ userIds: string[]; threadRootId?: string }> {
  const post = String(postId || "").trim()
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(post)) return { userIds: [] }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { userIds: [] }
  const boundedLimit = Math.min(Math.max(Math.trunc(limit) || 24, 1), 40)
  const threadAuthors = new Set<string>()
  try {
    let threadRootId: string | undefined
    let cursor = parentId && /^[a-zA-Z0-9_-]{1,180}$/.test(parentId) ? parentId : ""
    const visited = new Set<string>()
    for (let depth = 0; cursor && depth < 8 && !visited.has(cursor); depth += 1) {
      visited.add(cursor)
      const parentUrl = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_post_comments`)
      parentUrl.searchParams.set("id", `eq.${cursor}`)
      parentUrl.searchParams.set("post_id", `eq.${post}`)
      parentUrl.searchParams.set("deleted_at", "is.null")
      parentUrl.searchParams.set("select", "id,parent_id,author_id")
      parentUrl.searchParams.set("limit", "1")
      const parentResponse = await fetch(parentUrl.toString(), {
        headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
        cache: "no-store", signal: AbortSignal.timeout(5_000),
      })
      const parentRows = await parentResponse.json().catch(() => []) as Array<{ id?: string; parent_id?: string | null; author_id?: string }>
      const parent = parentResponse.ok && Array.isArray(parentRows) ? parentRows[0] : null
      if (!parent?.id) break
      threadRootId = String(parent.id)
      if (parent.author_id) threadAuthors.add(String(parent.author_id))
      cursor = String(parent.parent_id || "").trim()
    }

    const url = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_post_comments`)
    url.searchParams.set("post_id", `eq.${post}`)
    url.searchParams.set("deleted_at", "is.null")
    url.searchParams.set("select", "id,parent_id,author_id")
    url.searchParams.set("order", "created_at.desc")
    url.searchParams.set("limit", String(threadRootId ? 200 : boundedLimit))
    if (!threadRootId) url.searchParams.set("created_at", `gte.${new Date(Date.now() - 30 * 86400000).toISOString()}`)
    const response = await fetch(url.toString(), {
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      cache: "no-store", signal: AbortSignal.timeout(5_000),
    })
    const rows = await response.json().catch(() => []) as Array<{ id?: string; parent_id?: string | null; author_id?: string }>
    if (!response.ok || !Array.isArray(rows)) return { userIds: [], threadRootId }

    if (threadRootId) {
      // Walk the bounded in-memory parent graph so nested replies are included,
      // not just direct replies to the root comment.
      const threadIds = new Set<string>([threadRootId])
      let changed = true
      for (let depth = 0; changed && depth < 8; depth += 1) {
        changed = false
        for (const row of rows) {
          const id = String(row.id || "").trim()
          const parent = String(row.parent_id || "").trim()
          if (id && parent && threadIds.has(parent) && !threadIds.has(id)) {
            threadIds.add(id)
            if (row.author_id) threadAuthors.add(String(row.author_id))
            changed = true
          }
        }
      }
    } else {
      for (const row of rows) if (row.author_id) threadAuthors.add(String(row.author_id))
    }

    const actor = String(actorUserId || "")
    const ids = Array.from(threadAuthors).filter((id) => id && id !== actor).slice(0, boundedLimit)
    return { userIds: ids, threadRootId }
  } catch {
    return { userIds: [], threadRootId: undefined }
  }
}

/** Listing posts carry their listing key so comment notifications open the listing itself. */
export async function lookupPostListingId(postId: string): Promise<string | null> {
  const id = String(postId || "").trim()
  const env = readGhcServerEnv()
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(id) || !env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts`)
    url.searchParams.set("id", `eq.${id}`)
    url.searchParams.set("deleted_at", "is.null")
    url.searchParams.set("select", "listing_id")
    url.searchParams.set("limit", "1")
    const response = await fetch(url.toString(), {
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      cache: "no-store", signal: AbortSignal.timeout(5_000),
    })
    const rows = await response.json().catch(() => []) as Array<{ listing_id?: string | null }>
    return response.ok && Array.isArray(rows) && rows[0]?.listing_id ? String(rows[0].listing_id) : null
  } catch { return null }
}

