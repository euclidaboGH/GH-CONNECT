/**
 * POST /api/social/posts/[id]/reactions — toggle like for session user.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, liked: true, likeCount: null })
  }

  const result = await socialRpc("gh_reaction_toggle", {
    p_post_id: postId,
    p_user_id: auth.userId,
    p_reaction: "like",
  })
  const data = result.data as {
    ok?: boolean
    liked?: boolean
    likeCount?: number
    error?: string
  }
  if (!result.ok || data?.ok === false) {
    const status = data?.error === "NOT_FOUND" ? 404 : 503
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "REACTION_FAILED" },
      { status }
    )
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    liked: Boolean(data?.liked),
    likeCount: data?.likeCount ?? null,
  })
}
