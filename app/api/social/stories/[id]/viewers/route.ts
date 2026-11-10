/**
 * GET /api/social/stories/[id]/viewers — story owner only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
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
  const rl = checkRateLimit(`story-viewers:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }
  const { id } = await ctx.params
  const storyId = String(id || "").trim()
  if (!storyId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit") || 50) || 50))

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, users: [], storyId })
  }

  const result = await socialRpc("gh_list_story_viewers", {
    p_actor_id: auth.userId,
    p_story_id: storyId,
    p_limit: limit,
  })
  const data = (result.data || {}) as { ok?: boolean; error?: string; users?: unknown[] }
  if (!result.ok || data.ok === false) {
    const code = String(data.error || result.error || "LIST_FAILED")
    const status = code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 503
    return NextResponse.json({ ok: false, error: code, durable: false }, { status })
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    storyId,
    users: Array.isArray(data.users) ? data.users : [],
  })
}
