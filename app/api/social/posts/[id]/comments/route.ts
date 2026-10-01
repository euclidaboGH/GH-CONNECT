/**
 * GET  /api/social/posts/[id]/comments
 * POST /api/social/posts/[id]/comments — author = session user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { emitSocialNotification, lookupPostAuthor } from "@/lib/server/social/notifications"
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
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, comments: [] })
  }
  // Viewer identity is session-bound; post visibility policy is enforced in feed/RPC layer.
  // Comments are not publicly enumerable without auth.
  void auth
  const result = await socialRpc("gh_comment_list", { p_post_id: postId })
  const data = result.data as { comments?: unknown[] }
  return NextResponse.json({
    ok: true,
    durable: result.ok,
    comments: Array.isArray(data?.comments) ? data.comments : [],
  })
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

  const comment = {
    id: String(body.id || "").trim() || genId(),
    postId,
    authorId: auth.userId,
    authorName: String(body.authorName || auth.username || "Member").slice(0, 120),
    authorPhoto: String(body.authorPhoto || "").slice(0, 2000),
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
    const status = data?.error === "POST_NOT_FOUND" ? 404 : 503
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "COMMENT_FAILED" },
      { status }
    )
  }
  void (async () => {
    const authorId = await lookupPostAuthor(postId)
    if (authorId && authorId !== auth.userId) {
      const isReply = Boolean(comment.parentId)
      await emitSocialNotification({
        recipientUserId: authorId,
        actorUserId: auth.userId,
        type: isReply ? "comment_reply" : "post_comment",
        entityType: "post",
        entityId: postId,
        title: isReply ? "New reply" : "New comment",
        body: isReply ? "Someone replied on your post" : "Someone commented on your post",
        dedupeKey: `comment:${comment.id}`,
        metadata: { postId, commentId: comment.id },
      })
    }
    // Server-side @username mentions (max 5) — resolve against profiles, not client IDs
    const handles = Array.from(
      new Set(
        (String(comment.text || "").match(/@([a-zA-Z0-9_]{2,32})/g) || [])
          .map((m) => m.slice(1).toLowerCase())
          .slice(0, 5)
      )
    )
    if (handles.length === 0) return
    const envMod = await import("@/lib/server/economy/env")
    const env = envMod.readGhcServerEnv()
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
    for (const handle of handles) {
      try {
        const url = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_profiles`)
        url.searchParams.set("username", `ilike.${handle}`)
        url.searchParams.set("select", "gh_user_id,username")
        url.searchParams.set("limit", "1")
        const res = await fetch(url.toString(), {
          headers: {
            apikey: env.supabaseServiceRoleKey,
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          },
          cache: "no-store",
        })
        const rows = (await res.json().catch(() => [])) as Array<{ gh_user_id?: string }>
        const uid = rows[0]?.gh_user_id ? String(rows[0].gh_user_id) : ""
        if (!uid || uid === auth.userId) continue
        await emitSocialNotification({
          recipientUserId: uid,
          actorUserId: auth.userId,
          type: "mention",
          entityType: "post",
          entityId: postId,
          title: "You were mentioned",
          body: "Someone mentioned you in a comment",
          dedupeKey: `mention:${comment.id}:${uid}`,
          metadata: { postId, commentId: comment.id, handle },
        })
      } catch {
        /* ignore single mention failure */
      }
    }
  })()
  return NextResponse.json({ ok: true, durable: true, comment })
}
