/**
 * DELETE /api/social/posts/[id] — soft-delete own post only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
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
    return NextResponse.json({ ok: true, durable: false, id: postId })
  }

  const result = await socialRpc("gh_post_soft_delete", {
    p_post_id: postId,
    p_actor_id: auth.userId,
  })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "DELETE_FAILED" },
      { status: 503 }
    )
  }
  if (data?.error === "FORBIDDEN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (data?.error === "NOT_FOUND") {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, durable: true, id: postId })
}
