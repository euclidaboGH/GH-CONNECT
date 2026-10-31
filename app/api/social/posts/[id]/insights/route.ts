/**
 * GET /api/social/posts/[id]/insights
 * Server-side attention / engagement read model (Phase 2.5).
 * Spec: docs/GH_ATTENTION.md
 *
 * Authorization: session required; author sees metrics for any visibility;
 * non-authors only for public posts. No raw event lists. Zero economy side effects.
 * Feed listing does NOT call this endpoint.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  if (!postId || postId.length > 128) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  // Soft-fail: analytics must not break the product shell
  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      postId,
      metrics: null,
      reason: "DB_UNAVAILABLE",
    })
  }

  const result = await socialRpc("gh_post_attention_summary", {
    p_post_id: postId,
    p_viewer_id: auth.userId,
  })

  const data = result.data as {
    ok?: boolean
    error?: string
    postId?: string
    isAuthor?: boolean
    visibility?: string
    metrics?: Record<string, number>
    source?: string
  }

  if (!result.ok || data?.ok === false) {
    const err = data?.error || result.error || "INSIGHTS_FAILED"
    if (err === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
    }
    if (err === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }
    return NextResponse.json({
      ok: true,
      durable: false,
      postId,
      metrics: null,
      reason: "PERSIST_FAILED",
    })
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    postId: data.postId || postId,
    isAuthor: Boolean(data.isAuthor),
    visibility: data.visibility || null,
    metrics: data.metrics || null,
    source: data.source || "server_aggregates",
  })
}
