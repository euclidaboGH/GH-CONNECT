/** Per-member conversation controls. Actor identity is always session-derived. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ conversationId: string }> }
const noStore = { "Cache-Control": "no-store" }
const validId = (id: string) => Boolean(id && id.length <= 180 && !/[\u0000-\u001f\u007f]/.test(id))

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const rl = await checkDurableRateLimit(`messaging-conversation-prefs-read:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, { status: durableRateLimitStatus(rl), headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
  const { conversationId } = await ctx.params
  if (!validId(conversationId)) return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: noStore })
  const targetUserId = new URL(request.url).searchParams.get("targetUserId")
  if (targetUserId && (targetUserId.length > 180 || /[\u0000-\u001f\u007f]/.test(targetUserId))) return NextResponse.json({ ok: false, error: "INVALID_NICKNAME_TARGET" }, { status: 400, headers: noStore })
  const result = await socialRpc("gh_get_conversation_controls", { p_conversation_id: conversationId, p_actor_id: auth.userId, p_target_user_id: targetUserId })
  const data = result.data as Record<string, unknown> | null
  if (!result.ok || !data?.ok) return NextResponse.json({ ok: false, error: data?.error || "STORE_UNAVAILABLE" }, { status: data?.error === "FORBIDDEN" ? 403 : 503, headers: noStore })
  return NextResponse.json({ ...data, durable: true }, { headers: noStore })
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const rl = await checkDurableRateLimit(`messaging-conversation-prefs-write:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, { status: durableRateLimitStatus(rl), headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
  const { conversationId } = await ctx.params
  if (!validId(conversationId)) return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: noStore })
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: noStore })
  const b = parsed.value
  const hasNickname = Object.prototype.hasOwnProperty.call(b, "nickname")
  const hasReaction = Object.prototype.hasOwnProperty.call(b, "quickReaction")
  const hasReceipts = Object.prototype.hasOwnProperty.call(b, "readReceiptsEnabled")
  const hasPinned = Object.prototype.hasOwnProperty.call(b, "isPinned")
  const hasArchived = Object.prototype.hasOwnProperty.call(b, "isArchived")
  const hasMuted = Object.prototype.hasOwnProperty.call(b, "mutedUntil")
  const nickname = hasNickname && typeof b.nickname === "string" ? b.nickname.trim() : null
  const targetUserId = typeof b.targetUserId === "string" ? b.targetUserId.trim() : ""
  const reaction = hasReaction && typeof b.quickReaction === "string" ? b.quickReaction.trim() : null
  if ((!hasNickname && !hasReaction && !hasReceipts && !hasPinned && !hasArchived && !hasMuted) ||
      (hasNickname && (typeof b.nickname !== "string" || nickname!.length > 48 || !targetUserId || targetUserId.length > 180 || /[\u0000-\u001f\u007f]/.test(targetUserId))) ||
      (hasReaction && (typeof b.quickReaction !== "string" || !reaction || reaction.length > 16)) ||
      (hasReceipts && typeof b.readReceiptsEnabled !== "boolean") ||
      (hasPinned && typeof b.isPinned !== "boolean") || (hasArchived && typeof b.isArchived !== "boolean") ||
      (hasMuted && b.mutedUntil !== null && (typeof b.mutedUntil !== "number" || !Number.isSafeInteger(b.mutedUntil) || b.mutedUntil < 0 || b.mutedUntil > 8_640_000_000_000_000))) {
    return NextResponse.json({ ok: false, error: "INVALID_PREFERENCE" }, { status: 400, headers: noStore })
  }
  const saved = await socialRpc("gh_set_conversation_controls", {
    p_conversation_id: conversationId, p_actor_id: auth.userId,
    p_target_user_id: targetUserId || null, p_nickname: nickname, p_set_nickname: hasNickname,
    p_quick_reaction: reaction,
    p_read_receipts_enabled: hasReceipts ? b.readReceiptsEnabled : null,
    p_is_pinned: hasPinned ? b.isPinned : null,
    p_is_archived: hasArchived ? b.isArchived : null,
    p_muted_until: hasMuted && b.mutedUntil !== null ? new Date(b.mutedUntil as number).toISOString() : null,
    p_clear_mute: hasMuted && b.mutedUntil === null,
  })
  const sd = saved.data as Record<string, unknown> | null
  if (!saved.ok || !sd?.ok) return NextResponse.json({ ok: false, error: sd?.error || "PREFS_FAILED" }, { status: sd?.error === "FORBIDDEN" ? 403 : 503, headers: noStore })
  return NextResponse.json({ ...sd, durable: true, conversationId }, { headers: noStore })
}
