/**
 * GET  /api/social/posts/[id]/comments
 * POST /api/social/posts/[id]/comments — author = session user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

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
    return NextResponse.json({ ok: true, durable: false, comment })
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
  return NextResponse.json({ ok: true, durable: true, comment })
}
