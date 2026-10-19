/**
 * POST /api/social/posts/[id]/restore — restore an author's soft-deleted post.
 *
 * Restores visibility only. It deliberately does not reinstate historical GHPV
 * weights, votes, rewards, or GHC; those require a separate reviewed workflow.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"

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
  if (!postId || postId.length > 200) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Post restore")
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_post_restore", {
    p_post_id: postId,
    p_actor_id: auth.userId,
  })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "RESTORE_UNAVAILABLE" },
      { status: 503 }
    )
  }

  const data = result.data as { ok?: boolean; error?: string; id?: string; restored?: boolean }
  if (data?.error === "FORBIDDEN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (data?.error === "NOT_FOUND") {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (data?.error === "NOT_DELETED") {
    return NextResponse.json({ ok: false, error: "NOT_DELETED" }, { status: 409 })
  }
  if (data?.error === "RESTORE_WINDOW_EXPIRED") {
    return NextResponse.json({ ok: false, error: "RESTORE_WINDOW_EXPIRED" }, { status: 410 })
  }
  if (data?.ok !== true) {
    return NextResponse.json({ ok: false, error: data?.error || "RESTORE_FAILED" }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    id: postId,
    restored: Boolean(data.restored),
    ghcMutated: false,
    curationWeightsRestored: false,
  })
}
