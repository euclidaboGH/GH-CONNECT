/** Authenticated inbox for pending group invitations. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { socialDbConfigured, socialRest } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private" }
type InviteRow = { id: string; conversation_id: string; invited_by: string; created_at: string }
type ConversationRow = { id: string; title: string | null }

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  if (auth.source !== "gh_session" || !auth.sessionId) return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 403, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`messaging-group-invites:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, { status: durableRateLimitStatus(rate), headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } })
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "STORE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const query = new URLSearchParams({ invited_user_id: `eq.${auth.userId}`, status: "eq.pending", expires_at: `gt.${new Date().toISOString()}`, select: "id,conversation_id,invited_by,created_at", order: "created_at.desc", limit: "20" })
  const invites = await socialRest<InviteRow[]>(`gh_conversation_invites?${query.toString()}`)
  if (!invites.ok || !Array.isArray(invites.data)) return NextResponse.json({ ok: false, error: "INVITES_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const ids = [...new Set(invites.data.map((row) => String(row.conversation_id || "")).filter((id) => /^[a-zA-Z0-9_-]{12,100}$/.test(id)))].slice(0, 20)
  let titleById = new Map<string, string>()
  if (ids.length) {
    const titleQuery = new URLSearchParams({ id: `in.(${ids.map((id) => `"${id}"`).join(",")})`, select: "id,title", limit: "20" })
    const conversations = await socialRest<ConversationRow[]>(`gh_conversations?${titleQuery.toString()}`)
    if (conversations.ok && Array.isArray(conversations.data)) titleById = new Map(conversations.data.map((row) => [row.id, String(row.title || "Group conversation").slice(0, 80)] as const))
  }
  return NextResponse.json({ ok: true, durable: true, invites: invites.data.map((row) => ({ id: row.id, conversationId: row.conversation_id, title: titleById.get(row.conversation_id) || "Group invitation", invitedBy: row.invited_by, createdAt: Date.parse(row.created_at) || 0 })) }, { headers: NO_STORE })
}
