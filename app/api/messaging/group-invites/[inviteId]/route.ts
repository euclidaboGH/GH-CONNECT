/** Accept or decline a group invitation; actor is session-derived. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private" }
type Ctx = { params: Promise<{ inviteId: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  if (auth.source !== "gh_session" || !auth.sessionId) return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 403, headers: NO_STORE })
  const { inviteId } = await ctx.params
  if (!inviteId || inviteId.length > 180 || !/^ginv_[a-f0-9]{32}$/i.test(inviteId)) return NextResponse.json({ ok: false, error: "INVALID_INVITE_ID" }, { status: 400, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`messaging-group-invite-response:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, { status: durableRateLimitStatus(rate), headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } })
  const parsed = await readBoundedJson(request, 1024)
  if (!parsed.ok || typeof parsed.value.accept !== "boolean") return NextResponse.json({ ok: false, error: parsed.ok ? "INVALID_RESPONSE" : parsed.error }, { status: 400, headers: NO_STORE })
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "STORE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const result = await socialRpc("gh_messaging_group_invite_respond", { p_invite_id: inviteId, p_actor_id: auth.userId, p_accept: parsed.value.accept })
  const data = result.data as { ok?: boolean; error?: string; conversation_id?: string; accepted?: boolean; idempotent?: boolean } | null
  if (!result.ok || !data?.ok) {
    const code = data?.error || result.error || "INVITE_RESPONSE_UNAVAILABLE"
    const status = code === "INVITE_NOT_FOUND" ? 404 : code === "BLOCKED_PARTICIPANT" ? 403 : code === "INVITE_NOT_PENDING" || code === "INVITE_EXPIRED" ? 409 : 503
    return NextResponse.json({ ok: false, error: code }, { status, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true, durable: true, idempotent: Boolean(data.idempotent), accepted: data.accepted, conversationId: data.conversation_id }, { headers: NO_STORE })
}
