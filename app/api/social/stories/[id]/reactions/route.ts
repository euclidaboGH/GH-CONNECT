/** POST /api/social/stories/[id]/reactions — toggle a durable story reaction. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_REACTIONS = new Set(["💚", "🔥", "👏", "😂", "😍"])

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const limit = checkRateLimit(`story-reaction:${auth.userId}`, 90, 60_000)
  if (!limit.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSec) } })
  const { id } = await ctx.params
  const storyId = String(id || "").trim()
  if (!storyId || storyId.length > 160) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  const body = await request.json().catch(() => ({})) as { reaction?: unknown }
  const reaction = String(body.reaction || "")
  if (!ALLOWED_REACTIONS.has(reaction)) return NextResponse.json({ ok: false, error: "INVALID_REACTION" }, { status: 400 })
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Story reaction", { extra: { active: false, reactionCounts: {}, viewerReactions: [] } })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }
  const result = await socialRpc("gh_story_reaction_toggle", { p_story_id: storyId, p_user_id: auth.userId, p_reaction: reaction })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "REACTION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const data = result.data as { ok?: boolean; error?: string; active?: boolean; reaction?: string; reactionCounts?: Record<string, number>; viewerReactions?: string[]; reactionCount?: number } | null
  if (!data || data.ok !== true) {
    const error = data?.error || "REACTION_FAILED"
    const status = error === "NOT_AVAILABLE" ? 404 : error === "SELF_REACTION" ? 403 : 400
    return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, durable: true, ...data }, { headers: { "Cache-Control": "no-store" } })
}
