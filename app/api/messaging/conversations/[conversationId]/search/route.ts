/** Indexed, server-side full-history message search; membership is rechecked inside the RPC. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ conversationId: string }> }
const noStore = { "Cache-Control": "no-store" }
export async function GET(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    const rl = await checkDurableRateLimit(`messaging-search:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
    if (!rl.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, { status: durableRateLimitStatus(rl), headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
    const { conversationId } = await ctx.params
    if (!conversationId || conversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(conversationId)) return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: noStore })
    const url = new URL(request.url)
    const q = (url.searchParams.get("q") || "").trim()
    const limit = Number(url.searchParams.get("limit") || 30)
    const offset = Number(url.searchParams.get("offset") || 0)
    if (q.length < 2 || q.length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(offset) || offset < 0 || offset > 1000) return NextResponse.json({ ok: false, error: "INVALID_SEARCH_PARAMS" }, { status: 400, headers: noStore })
    const result = await socialRpc("gh_search_conversation_messages", { p_conversation_id: conversationId, p_actor_id: auth.userId, p_query: q, p_limit: limit, p_offset: offset })
    const data = result.data as Record<string, unknown> | null
    if (!result.ok || !data?.ok) return NextResponse.json({ ok: false, error: data?.error || "SEARCH_UNAVAILABLE" }, { status: data?.error === "FORBIDDEN" ? 403 : data?.error === "INVALID_QUERY" ? 400 : 503, headers: noStore })
    return NextResponse.json({ ...data, durable: true }, { headers: noStore })
  } catch (error) {
    console.error("[messaging/search GET]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "SEARCH_FAILED" }, { status: 500, headers: noStore })
  }
}
