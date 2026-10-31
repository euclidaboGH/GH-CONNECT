/**
 * POST /api/messaging/conversations/:id/ensure-member
 * Idempotent: ensures the authenticated user is a member of a community/group conversation.
 * Used when opening a community chat or after social join/create so the first send is not FORBIDDEN.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { isMember } from "@/lib/server/messaging/message-store"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ conversationId: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    }
    const rl = checkRateLimit(`msg-ensure-member:${auth.userId}`, 40, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } }
      )
    }
    const { conversationId } = await ctx.params
    const cid = String(conversationId || "").trim()
    if (!cid || cid.length > 180 || /[\u0000-\u001f\u007f]/.test(cid)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }

    // Community chat is owner-created and opt-in. This endpoint may never
    // fabricate a chat shell or silently add arbitrary users.
    if (!socialDbConfigured()) {
      return NextResponse.json({ ok: false, error: "STORE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
    }
    const joined = await socialRpc("gh_community_chat_join", {
      p_community_id: cid,
      p_user_id: auth.userId,
    })
    const data = joined.data as { ok?: boolean; status?: string; error?: string } | null
    if (!joined.ok || data?.ok === false) {
      const error = data?.error || joined.error || "CHAT_JOIN_FAILED"
      const status = error === "COMMUNITY_MEMBERSHIP_REQUIRED" ? 403 : error === "CHAT_NOT_CREATED" ? 409 : 503
      return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } })
    }
    if (data?.status === "pending") {
      return NextResponse.json({ ok: false, error: "CHAT_APPROVAL_REQUIRED", status: "pending" }, { status: 403, headers: { "Cache-Control": "no-store" } })
    }
    const member = await isMember(cid, auth.userId)
    return NextResponse.json(
      { ok: true, conversationId: cid, member },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error("[messaging/ensure-member]", err instanceof Error ? err.message : "unknown")
    return NextResponse.json({ ok: false, error: "ENSURE_FAILED" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
