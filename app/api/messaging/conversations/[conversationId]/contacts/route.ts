/** Share only the authenticated actor's public GreenHaven profile in a conversation. */
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private" }
type Ctx = { params: Promise<{ conversationId: string }> }

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  if (auth.source !== "gh_session" || !auth.sessionId) return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 403, headers: NO_STORE })
  const { conversationId } = await ctx.params
  if (!conversationId || conversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(conversationId)) return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`messaging-contact-share:${auth.userId}`, 10, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, { status: durableRateLimitStatus(rate), headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } })
  const parsed = await readBoundedJson(request, 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers: NO_STORE })
  const clientMessageId = typeof parsed.value.clientMessageId === "string" ? parsed.value.clientMessageId.trim() : randomUUID()
  if (!clientMessageId || clientMessageId.length > 80 || /[\u0000-\u001f\u007f]/.test(clientMessageId)) return NextResponse.json({ ok: false, error: "INVALID_CLIENT_MESSAGE_ID" }, { status: 400, headers: NO_STORE })
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "STORE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const result = await socialRpc("gh_messaging_share_own_contact", { p_conversation_id: conversationId, p_actor_id: auth.userId, p_client_message_id: clientMessageId })
  const data = result.data as { ok?: boolean; error?: string; idempotent?: boolean; message?: unknown } | null
  if (!result.ok || !data?.ok) {
    const code = data?.error || result.error || "CONTACT_SHARE_UNAVAILABLE"
    const status = code === "FORBIDDEN" || code === "BLOCKED_PARTICIPANT" ? 403 : code === "PUBLIC_PROFILE_UNAVAILABLE" ? 409 : code === "IDEMPOTENCY_CONFLICT" ? 409 : 503
    return NextResponse.json({ ok: false, error: code }, { status, headers: NO_STORE })
  }
  const messageId = data.message && typeof data.message === "object" ? String((data.message as Record<string, unknown>).id || "") : ""
  if (!messageId) return NextResponse.json({ ok: false, error: "CONTACT_SHARE_RESULT_INVALID" }, { status: 503, headers: NO_STORE })
  if (!data.idempotent) await socialRpc("gh_social_notify_message_members", { p_sender_id: auth.userId, p_conversation_id: conversationId, p_message_id: messageId }).catch(() => null)
  return NextResponse.json({ ok: true, durable: true, idempotent: Boolean(data.idempotent), message: data.message }, { headers: NO_STORE })
}
