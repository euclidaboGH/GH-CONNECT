/**
 * GET  /api/social/posts/[id]/comments
 * POST /api/social/posts/[id]/comments — author = session user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { emitSocialNotification, lookupPostAuthor } from "@/lib/server/social/notifications"
import { getServerProfile } from "@/lib/server/identity/profile-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function genId(): string {
  return `cmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  if (!socialDbConfigured()) return NextResponse.json({ ok: true, durable: false, comments: [], nextCursor: null })

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 100)
  const before = Number(url.searchParams.get("before") || 0)
  const beforeId = String(url.searchParams.get("beforeId") || "").trim()
  if ((before && !Number.isFinite(before)) || before < 0 || beforeId.length > 160) {
    return NextResponse.json({ ok: false, error: "INVALID_CURSOR" }, { status: 400 })
  }

  // Prefer stable (createdAt,id) cursor RPC. Keep legacy fallback until migration is applied.
  const v2 = await socialRpc("gh_comment_list_v2", {
    p_post_id: postId, p_viewer_id: auth.userId, p_limit: limit + 1,
    p_before_ms: before || null, p_before_id: beforeId || null,
  })
  const chosen = v2.ok ? v2 : await socialRpc("gh_comment_list", { p_post_id: postId })
  const data = chosen.data as { comments?: unknown[] }
  let comments = Array.isArray(data?.comments) ? data.comments : []
  const hasMore = comments.length > limit
  if (hasMore) comments = comments.slice(0, limit)
  const last = comments[comments.length - 1] as { id?: unknown; createdAt?: unknown } | undefined
  const nextCursor = hasMore && last ? { before: Number(last.createdAt) || 0, beforeId: String(last.id || "") } : null
  return NextResponse.json({ ok: true, durable: chosen.ok, comments, nextCursor, stableCursor: v2.ok })
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`comment:${auth.userId}`, 40, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const text = String(body.text || body.content || "").trim()
  if (!text) {
    return NextResponse.json({ ok: false, error: "EMPTY_COMMENT" }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ ok: false, error: "TOO_LONG" }, { status: 400 })
  }

  // Ownership: authorId is always session user — never trust body.authorId / body.userId
  void body.authorId
  void body.userId
  const actorProfile = await getServerProfile(auth.userId).catch(() => null)
  // Display identity is server-derived too; client may not impersonate another profile snapshot.
  const comment = {
    id: String(body.id || "").trim() || genId(),
    postId,
    authorId: auth.userId,
    authorName: String(actorProfile?.displayName || auth.username || "Member").slice(0, 120),
    authorPhoto: String(actorProfile?.photos?.[0] || "").slice(0, 2000),
    text,
    parentId: body.parentId || body.replyTo || null,
    createdAt: Date.now(),
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Comment create")
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_comment_create", { p_row: comment })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    const status = data?.error === "POST_NOT_FOUND" || data?.error === "PARENT_NOT_FOUND" ? 404 : 503
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "COMMENT_FAILED" },
      { status }
    )
  }
  void (async () => {
    const postAuthorId = await lookupPostAuthor(postId)
    let replyRecipientId: string | null = null
    if (comment.parentId) {
      const env = readGhcServerEnv()
      if (env.supabaseUrl && env.supabaseServiceRoleKey) {
        try {
          const u = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_post_comments`)
          u.searchParams.set("id", `eq.${String(comment.parentId)}`)
          u.searchParams.set("post_id", `eq.${postId}`)
          u.searchParams.set("deleted_at", "is.null")
          u.searchParams.set("select", "author_id")
          u.searchParams.set("limit", "1")
          const r = await fetch(u.toString(), { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" })
          const rows = await r.json().catch(() => []) as Array<{ author_id?: string }>
          replyRecipientId = rows[0]?.author_id ? String(rows[0].author_id) : null
        } catch { /* notification lookup must not fail comment creation */ }
      }
    }
    const primaryRecipient = comment.parentId ? replyRecipientId : postAuthorId
    if (primaryRecipient && primaryRecipient !== auth.userId) {
      await emitSocialNotification({ recipientUserId: primaryRecipient, actorUserId: auth.userId,
        type: comment.parentId ? "comment_reply" : "post_comment", entityType: "comment", entityId: comment.id,
        title: comment.parentId ? "New reply" : "New comment",
        body: comment.parentId ? "Someone replied to your comment" : "Someone commented on your post",
        dedupeKey: `comment:${comment.id}:${primaryRecipient}`, metadata: { postId, commentId: comment.id, parentId: comment.parentId } })
    }
    // A reply also matters to the post author, unless they are actor/parent recipient.
    if (comment.parentId && postAuthorId && postAuthorId !== auth.userId && postAuthorId !== primaryRecipient) {
      await emitSocialNotification({ recipientUserId: postAuthorId, actorUserId: auth.userId, type: "post_comment",
        entityType: "comment", entityId: comment.id, title: "New comment activity", body: "A conversation continued on your post",
        dedupeKey: `post-comment:${comment.id}:${postAuthorId}`, metadata: { postId, commentId: comment.id } })
    }

    const handles = Array.from(new Set((String(comment.text || "").match(/@([a-zA-Z0-9_]{2,32})/g) || []).map(m => m.slice(1).toLowerCase()))).slice(0, 5)
    if (!handles.length) return
    const env = readGhcServerEnv()
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
    try {
      const u = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_profiles`)
      u.searchParams.set("or", `(${handles.map(h => `username.ilike.${h}`).join(",")})`)
      u.searchParams.set("select", "gh_user_id,username")
      u.searchParams.set("limit", String(handles.length))
      const r = await fetch(u.toString(), { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" })
      const rows = await r.json().catch(() => []) as Array<{ gh_user_id?: string; username?: string }>
      await Promise.all(rows.map(async row => {
        const uid = String(row.gh_user_id || "")
        const handle = String(row.username || "").toLowerCase()
        if (!uid || uid === auth.userId || !handles.includes(handle)) return
        await emitSocialNotification({ recipientUserId: uid, actorUserId: auth.userId, type: "mention", entityType: "comment", entityId: comment.id,
          title: "You were mentioned", body: "Someone mentioned you in a comment", dedupeKey: `mention:${comment.id}:${uid}`, metadata: { postId, commentId: comment.id, handle } })
      }))
    } catch { /* mentions are non-critical */ }
  })()
  return NextResponse.json({ ok: true, durable: true, comment })
}
