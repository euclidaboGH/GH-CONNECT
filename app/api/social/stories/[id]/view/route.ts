/**
 * POST /api/social/stories/[id]/view — record view for session user
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
  const storyId = String(id || "").trim()
  if (!storyId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false })
  }
  const result = await socialRpc("gh_story_view", {
    p_story_id: storyId,
    p_viewer_id: auth.userId,
  })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "VIEW_FAILED" },
      { status: data?.error === "NOT_AVAILABLE" ? 404 : 503 }
    )
  }
  return NextResponse.json({ ok: true, durable: true })
}
