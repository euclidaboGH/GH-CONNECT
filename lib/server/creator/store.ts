import { readGhcServerEnv } from "@/lib/server/economy/env"

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
        error: String((data && (data.message || data.error)) || `HTTP_${res.status}`),
      }
    }
    return { ok: true, data: data || {} }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "RPC_FAILED" }
  }
}

async function restGet(path: string): Promise<{ ok: boolean; data: unknown }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, data: null }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path.replace(/^\//, "")}`,
      {
        headers: {
          Accept: "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    )
    if (!res.ok) return { ok: false, data: null }
    return { ok: true, data: await res.json().catch(() => null) }
  } catch {
    return { ok: false, data: null }
  }
}

export async function getCreatorProfile(userId: string) {
  const r = await rpc("gh_creator_get", { p_user_id: userId })
  if (!r.ok || !r.data) return { ok: false as const, error: r.error || "GET_FAILED" }
  if (r.data.ok === false) return { ok: false as const, error: String(r.data.error) }
  return { ok: true as const, ...r.data }
}

export async function upsertCreatorProfile(input: {
  userId: string
  displayName?: string
  tagline?: string
  bio?: string
  tipsEnabled?: boolean
}) {
  const r = await rpc("gh_creator_upsert", {
    p_user_id: input.userId,
    p_display_name: input.displayName ?? null,
    p_tagline: input.tagline ?? null,
    p_bio: input.bio ?? null,
    p_tips_enabled: input.tipsEnabled ?? false,
  })
  if (!r.ok || !r.data || r.data.ok === false) {
    return { ok: false as const, error: r.error || String(r.data?.error || "UPSERT_FAILED") }
  }
  return { ok: true as const, ...r.data }
}

/** Own posts for Creator Studio — ownership enforced by author_id filter */
export async function listCreatorPosts(userId: string, limit = 50) {
  const q =
    `gh_posts?author_id=eq.${encodeURIComponent(userId)}` +
    `&deleted_at=is.null&select=id,content,visibility,like_count,comment_count,share_count,view_count,qualified_view_count,upvote_count,downvote_count,created_at,updated_at` +
    `&order=created_at.desc&limit=${Math.min(100, Math.max(1, limit))}`
  const res = await restGet(q)
  if (!res.ok) return { ok: false as const, error: "LIST_FAILED", posts: [] as unknown[] }
  const posts = Array.isArray(res.data) ? res.data : []
  return { ok: true as const, posts }
}

export async function createTipIntent(input: {
  tipperId: string
  recipientId: string
  idempotencyKey: string
  contentId?: string
  contentKind?: string
  currency?: string
  amountUnits?: number
  note?: string
}) {
  const r = await rpc("gh_tip_intent_create", {
    p_tipper_id: input.tipperId,
    p_recipient_id: input.recipientId,
    p_idempotency_key: input.idempotencyKey,
    p_content_id: input.contentId ?? null,
    p_content_kind: input.contentKind ?? "post",
    p_currency: input.currency ?? "PI",
    p_amount_units: input.amountUnits ?? null,
    p_note: input.note ?? null,
  })
  if (!r.ok || !r.data) return { ok: false as const, error: r.error || "TIP_FAILED" }
  if (r.data.ok === false) return { ok: false as const, error: String(r.data.error) }
  return {
    ok: true as const,
    intentId: String(r.data.intentId || ""),
    status: String(r.data.status || "initiated"),
    duplicate: Boolean(r.data.duplicate),
    settlement: "deferred" as const,
    message: String(r.data.message || ""),
  }
}

/** Resolve post author for tip recipient (server-derived) */
export async function resolvePostAuthor(
  postId: string
): Promise<{ ok: boolean; authorId?: string; deleted?: boolean; error?: string }> {
  const q =
    `gh_posts?id=eq.${encodeURIComponent(postId)}` +
    `&select=id,author_id,deleted_at&limit=1`
  const res = await restGet(q)
  if (!res.ok) return { ok: false, error: "LOOKUP_FAILED" }
  const rows = Array.isArray(res.data) ? res.data : []
  const row = rows[0] as { author_id?: string; deleted_at?: string | null } | undefined
  if (!row?.author_id) return { ok: false, error: "NOT_FOUND" }
  if (row.deleted_at) return { ok: false, error: "DELETED", deleted: true }
  return { ok: true, authorId: String(row.author_id) }
}
