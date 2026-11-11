import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const CALL_ID = /^call_[a-f0-9]{32}$/

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const rl = await checkDurableRateLimit(`call-incoming:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rl) }, { status: durableRateLimitStatus(rl), headers: { "Cache-Control": "no-store" } })
  const result = await socialRpc("gh_call_incoming_for_user", { p_actor_id: auth.userId })
  if (!result.ok) return NextResponse.json({ ok: false, error: "CALL_LOOKUP_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const data = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {}
  const call = data.call && typeof data.call === "object" ? data.call as Record<string, unknown> : null
  if (!call) return NextResponse.json({ ok: true, call: null }, { headers: { "Cache-Control": "no-store" } })
  const callerId = String(call.caller_id || "")
  const profile = callerId ? await fetchProfile(callerId) : null
  const profilePhotos = profile?.photos
  const photoUrl = Array.isArray(profilePhotos) ? profilePhotos.find((value: unknown) => typeof value === "string" && value.startsWith("https://")) : null
  return NextResponse.json({
    ok: true,
    call: {
      callId: String(call.id || ""),
      conversationId: String(call.conversation_id || ""),
      callerId,
      kind: call.media_kind === "video" ? "video" : "voice",
      peer: { userId: callerId, displayName: profile?.display_name || "GreenHaven member", photoUrl: typeof photoUrl === "string" ? photoUrl : null },
    },
  }, { headers: { "Cache-Control": "no-store" } })
}

async function fetchProfile(userId: string): Promise<{ display_name?: string | null; photos?: unknown } | null> {
  const { socialRest } = await import("@/lib/server/social/rpc")
  const result = await socialRest<Array<{ display_name?: string | null; photos?: unknown }>>(
    `gh_user_profiles?gh_user_id=eq.${encodeURIComponent(userId)}&select=display_name,photos&limit=1`,
  )
  return result.ok && Array.isArray(result.data) ? result.data[0] || null : null
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const rl = await checkDurableRateLimit(`call-start:${auth.userId}`, 8, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rl) }, { status: durableRateLimitStatus(rl), headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })
  const parsed = await readBoundedJson(request, 4096)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsed.value
  const callId = typeof body.callId === "string" ? body.callId : ""
  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : ""
  const kind = body.kind === "video" ? "video" : body.kind === "voice" ? "audio" : ""
  if (!CALL_ID.test(callId) || !conversationId || conversationId.length > 180 || !kind) return NextResponse.json({ ok: false, error: "INVALID_CALL" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const config = process.env.GH_CALLS_ENABLED === "true" && Boolean(process.env.GH_CALL_TURN_URLS && process.env.GH_CALL_TURN_SHARED_SECRET)
  if (!config) return NextResponse.json({ ok: false, error: "CALLS_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const result = await socialRpc("gh_call_start", { p_call_id: callId, p_conversation_id: conversationId, p_actor_id: auth.userId, p_media_kind: kind })
  if (!result.ok) return NextResponse.json({ ok: false, error: "CALL_START_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const data = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {}
  if (data.ok !== true) {
    const error = typeof data.error === "string" ? data.error : "CALL_START_REJECTED"
    const status = error === "BLOCKED" || error === "FORBIDDEN" ? 403 : error === "USER_ALREADY_IN_CALL" ? 409 : 400
    return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, call: data.call, replayed: Boolean(data.replayed) }, { headers: { "Cache-Control": "no-store" } })
}
