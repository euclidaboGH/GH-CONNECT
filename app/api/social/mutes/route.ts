/** POST /api/social/mutes — { targetUserId, mute: boolean } */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { checkDurableRateLimit, appendSecurityEvent, requestCorrelationId } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rate = await checkDurableRateLimit(`social-write:${auth.userId}:mute`, 60, 60_000)
  const correlationId = requestCorrelationId(request)
  if (!rate.ok) {
    void appendSecurityEvent({ eventType: "social.mute.rate_limited", outcome: "blocked", reasonCode: "RATE_LIMITED", actorUserId: auth.userId, correlationId })
    return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rate.retryAfterSec }, { status: 429 })
  }
  const body = await request.json().catch(() => ({}))
  const targetUserId = String(body.targetUserId || "").trim()
  if (!targetUserId || targetUserId === auth.userId) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 })
  }
  const mute = body.mute !== false && body.mute !== "false"
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Mute", { extra: { muted: mute } })
    return NextResponse.json(nd.body, { status: nd.status })
  }
  const result = await socialRpc("gh_mute_set", {
    p_muter: auth.userId,
    p_muted: targetUserId,
    p_mute: mute,
  })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "MUTE_FAILED" },
      { status: 503 }
    )
  }
  void appendSecurityEvent({ eventType: "social.mute", outcome: "allowed", actorUserId: auth.userId, targetUserId, correlationId, metadata: { muted: mute } })
  return NextResponse.json({ ok: true, durable: true, muted: mute })
}
