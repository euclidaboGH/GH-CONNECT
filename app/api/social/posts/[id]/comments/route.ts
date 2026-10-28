/**
 * GET  /api/social/posts/[id]/comments
 * POST /api/social/posts/[id]/comments — author = session user
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRest, socialRpc } from "@/lib/server/social/rpc"
import { emitSocialNotification, lookupPostAuthor } from "@/lib/server/social/notifications"
import { getServerProfile } from "@/lib/server/identity/profile-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import { canViewSocialPost } from "@/lib/server/social/post-visibility"
import { validateOwnedMediaAttachments } from "@/lib/server/media/owned-attachment-validation"
import { loadCommentReactionState } from "@/lib/server/social/comment-reactions"
import { hydratePublicProfileIdentity } from "@/lib/server/identity/public-profile-hydration"

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
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "SOCIAL_STORE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const canView = await canViewSocialPost(auth.userId, postId)
  if (canView === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!canView) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })

  const url = new URL(request.url)
  const rawLimit = url.searchParams.get("limit")
  const parsedLimit = rawLimit === null ? 40 : Number(rawLimit)
  if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return NextResponse.json({ ok: false, error: "INVALID_LIMIT" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const limit = parsedLimit
  const beforeRaw = url.searchParams.get("before")
  const beforeId = String(url.searchParams.get("beforeId") || "").trim()
  const hasCursor = beforeRaw !== null || beforeId !== ""
  const before = beforeRaw !== null && /^\d{1,16}$/.test(beforeRaw) ? Number(beforeRaw) : null
  if (hasCursor && (before === null || !Number.isSafeInteger(before) || before <= 0 || !beforeId || beforeId.length > 160 || /[\u0000-\u001f\u007f]/.test(beforeId))) {
    return NextResponse.json({ ok: false, error: "INVALID_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  // Final canonical comment contract. Historical v2/v1 RPCs and direct table
  // recovery are retired; a missing RPC is a deployment/schema error.
  const chosen = await socialRpc("gh_comment_list_v3", {
    p_post_id: postId, p_viewer_id: auth.userId, p_limit: limit + 1,
    p_before_ms: before, p_before_id: hasCursor ? beforeId : null,
  })
  if (!chosen.ok) {
    return NextResponse.json(
      { ok: false, error: "COMMENT_RPC_UNAVAILABLE", durable: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
  const data = chosen.data as { comments?: unknown[] }
  let comments = Array.isArray(data?.comments) ? data.comments : []
  const hasMore = comments.length > limit
  if (hasMore) comments = comments.slice(0, limit)
  const last = comments[comments.length - 1] as { id?: unknown; createdAt?: unknown } | undefined
  const nextCursor = hasMore && last ? { before: Number(last.createdAt) || 0, beforeId: String(last.id || "") } : null
  const reactionStates = await loadCommentReactionState(
    comments.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")),
    auth.userId,
  )
  const hydratedComments = comments.map((row) => {
    if (!row || typeof row !== "object") return row
    const comment = row as Record<string, unknown>
    const state = reactionStates.get(String(comment.id || ""))
    return state ? { ...comment, reactionCounts: state.reactionCounts, viewerReactions: state.viewerReactions } : comment
  })
  const rpcReadSucceeded = Boolean(chosen.ok && Array.isArray(data?.comments) && (data as { ok?: boolean })?.ok !== false)
  const publicComments = await hydratePublicProfileIdentity(hydratedComments.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")))
  return NextResponse.json({ ok: true, durable: true, comments: publicComments, nextCursor, stableCursor: true }, { headers: { "Cache-Control": "no-store" } })
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
  const canView = await canViewSocialPost(auth.userId, postId)
  if (canView === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!canView) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })

  const parsedBody = await readBoundedJson(request, 24 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value
  const text = String(body.text || body.content || "").trim()
  if (text.length > 2000) {
    return NextResponse.json({ ok: false, error: "TOO_LONG" }, { status: 400 })
  }

  // Durable first-party media only. Attachment IDs must resolve to ready assets owned by this actor.
  const rawMedia = Array.isArray(body.mediaAttachments)
    ? body.mediaAttachments
    : Array.isArray(body.media)
      ? body.media
      : []
  const attachmentValidation = await validateOwnedMediaAttachments({
    requestUrl: request.url,
    ownerId: auth.userId,
    raw: rawMedia,
    maxItems: 4,
  })
  if (!attachmentValidation.ok) {
    const status = attachmentValidation.error === "MEDIA_AUTHORIZATION_UNAVAILABLE" ? 503 : 400
    return NextResponse.json({ ok: false, error: attachmentValidation.error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  const media = attachmentValidation.attachments

  if (!text && media.length === 0) {
    return NextResponse.json({ ok: false, error: "EMPTY_COMMENT" }, { status: 400 })
  }

  // Ownership: authorId is always session user — never trust body.authorId / body.userId
  void body.authorId
  void body.userId
  const actorProfile = await getServerProfile(auth.userId).catch(() => null)
  // Display identity is server-derived too; client may not impersonate another profile snapshot.
  const requestedCommentId = String(body.id || "").trim()
  if (requestedCommentId && (requestedCommentId.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(requestedCommentId))) {
    return NextResponse.json({ ok: false, error: "INVALID_COMMENT_ID" }, { status: 400 })
  }
  const parentRaw = body.parentId ?? body.replyTo ?? null
  const parentId = parentRaw == null || parentRaw === "" ? null : String(parentRaw).trim()
  if (parentId && (parentId.length > 160 || /[\u0000-\u001f\u007f]/.test(parentId))) {
    return NextResponse.json({ ok: false, error: "INVALID_PARENT_ID" }, { status: 400 })
  }
  const comment = {
    id: requestedCommentId || genId(),
    postId,
    authorId: auth.userId,
    authorName: String(actorProfile?.displayName || auth.username || "Member").slice(0, 120),
    authorPhoto: String(actorProfile?.photos?.[0] || "").slice(0, 2000),
    text: text || (media.length ? (media[0] as { type?: string }).type === "video" ? "🎥 Video" : "📷 Photo" : ""),
    parentId,
    createdAt: Date.now(),
    media,
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Comment create")
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_comment_create", { p_row: comment })
  const data = result.data as { ok?: boolean; error?: string; id?: string; idempotent?: boolean; commentCount?: number }
  if (!result.ok || data?.ok === false) {
    const err = String(data?.error || result.error || "COMMENT_FAILED")
    if (/_HTTP_404$/.test(err) || result.status === 404) {
      return NextResponse.json(
        {
          ok: false,
          error: "SOCIAL_RPC_UNAVAILABLE",
          diagnosticCode: result.diagnosticCode || null,
          diagnosticMessage: result.diagnosticMessage || null,
          message: "Comment RPC is not installed. Apply supabase migration 20261022010099_ENSURE_social_engagement_rpcs.sql",
        },
        { status: 503 },
      )
    }
    const status = data?.error === "POST_NOT_FOUND" || data?.error === "PARENT_NOT_FOUND" ? 404
      : data?.error === "COMMENT_ID_CONFLICT" ? 409
        : data?.error === "INVALID" ? 400 : 503
    return NextResponse.json(
      { ok: false, error: err },
      { status }
    )
  }
  void (async () => {
    // A durable comment is an attention/conversation signal, not a GHC mint.
    // These calls are idempotent and must never block comment creation.
    await socialRpc("gh_content_event_record", {
      p_content_id: postId,
      p_content_kind: "post",
      p_actor_id: auth.userId,
      p_event_type: "comment",
      p_window_key: `comment:${comment.id}`,
      p_metadata: { commentId: comment.id, parentId: comment.parentId },
    }).catch(() => null)
    await socialRpc("gh_reputation_apply_event", {
      p_user_id: auth.userId,
      p_event_type: "comment_created",
      p_points: 1,
      p_idempotency_key: `comment:${comment.id}`,
      p_source_ref: comment.id,
      p_metadata: { postId, parentId: comment.parentId },
    }).catch(() => null)

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
  return NextResponse.json({ ok: true, durable: true, idempotent: Boolean(data.idempotent), commentCount: Number.isFinite(data.commentCount) ? Math.max(0, Number(data.commentCount)) : undefined, comment: { ...comment, id: String(data.id || comment.id) } }, { headers: { "Cache-Control": "no-store" } })
}
