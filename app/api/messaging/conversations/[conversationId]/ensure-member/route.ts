/**
 * POST /api/messaging/conversations/:id/ensure-member
 * Idempotent: ensures the authenticated user is a member of a community/group conversation.
 * Used when opening a community chat or after social join/create so the first send is not FORBIDDEN.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  ensureCommunityConversation,
  ensureCommunityMember,
  isMember,
} from "@/lib/server/messaging/message-store"

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

    let title: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      if (body && typeof body === "object" && body.title) {
        title = String(body.title).slice(0, 120)
      }
    } catch {
      /* */
    }

    const shell = await ensureCommunityConversation({
      communityId: cid,
      ownerId: auth.userId,
      title,
    })
    if (!shell.ok) {
      return NextResponse.json(
        { ok: false, error: shell.error || "ENSURE_FAILED" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }
    const mem = await ensureCommunityMember({
      communityId: cid,
      userId: auth.userId,
      role: "member",
    })
    if (!mem.ok) {
      return NextResponse.json(
        { ok: false, error: mem.error || "MEMBERSHIP_FAILED" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
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
