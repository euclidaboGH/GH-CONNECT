/** Create a group from an existing direct conversation. Invitees must accept. */
import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private" }

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  if (auth.source !== "gh_session" || !auth.sessionId) return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 403, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`messaging-group-create:${auth.userId}`, 5, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, { status: durableRateLimitStatus(rate), headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } })
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: NO_STORE })
  const body = parsed.value
  const sourceConversationId = typeof body.sourceConversationId === "string" ? body.sourceConversationId.trim() : ""
  const title = typeof body.title === "string" ? body.title.normalize("NFKC").trim() : ""
  const rawInvitees = Array.isArray(body.invitedUserIds) ? body.invitedUserIds : []
  const clientRequestId = typeof body.clientRequestId === "string" ? body.clientRequestId.trim() : ""
  if (!sourceConversationId || sourceConversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(sourceConversationId) || !title || title.length > 80 || rawInvitees.length > 20 || !/^[a-zA-Z0-9_-]{8,80}$/.test(clientRequestId)) {
    return NextResponse.json({ ok: false, error: "INVALID_GROUP" }, { status: 400, headers: NO_STORE })
  }
  const invitees: string[] = []
  for (const value of rawInvitees) {
    if (typeof value !== "string") return NextResponse.json({ ok: false, error: "INVALID_INVITEE" }, { status: 400, headers: NO_STORE })
    const id = value.trim()
    if (!id || id.length > 180 || /[\u0000-\u001f\u007f]/.test(id) || id === auth.userId) return NextResponse.json({ ok: false, error: "INVALID_INVITEE" }, { status: 400, headers: NO_STORE })
    if (!invitees.includes(id)) invitees.push(id)
  }
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "STORE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const groupId = `group_${randomBytes(16).toString("hex")}`
  const result = await socialRpc("gh_messaging_group_create_from_dm", {
    p_group_id: groupId,
    p_source_conversation_id: sourceConversationId,
    p_actor_id: auth.userId,
    p_title: title,
    p_invited_user_ids: invitees,
    p_client_request_id: clientRequestId,
  })
  const data = result.data as { ok?: boolean; error?: string; conversation_id?: string; invited_count?: number; idempotent?: boolean } | null
  if (!result.ok || !data?.ok) {
    const code = data?.error || result.error || "GROUP_CREATE_UNAVAILABLE"
    const status = code === "SOURCE_CONVERSATION_FORBIDDEN" || code === "BLOCKED_PARTICIPANT" ? 403
      : code === "INVITEE_NOT_FOUND" ? 404
      : code === "GROUP_ID_CONFLICT" || code === "SOURCE_PEER_INVALID" || code === "IDEMPOTENCY_CONFLICT" ? 409
      : code === "INVALID_GROUP" || code === "INVALID_INVITEE" || code === "INVITEE_LIMIT" ? 400
      : 503
    return NextResponse.json({ ok: false, error: code }, { status, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true, durable: true, idempotent: Boolean(data.idempotent), conversationId: data.conversation_id, invitedCount: data.invited_count }, { headers: NO_STORE })
}
