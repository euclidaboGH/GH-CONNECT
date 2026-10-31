/**
 * POST /api/social/blocks — { targetUserId, block: boolean }
 * Actor always from session.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, appendSecurityEvent, requestCorrelationId } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rate = await checkDurableRateLimit(`social-write:${auth.userId}:block`, 60, 60_000)
  const correlationId = requestCorrelationId(request)
  if (!rate.ok) {
    void appendSecurityEvent({ eventType: "social.block.rate_limited", outcome: "blocked", reasonCode: "RATE_LIMITED", actorUserId: auth.userId, correlationId })
    return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rate.retryAfterSec }, { status: 429 })
  }
  const parsedBody = await readBoundedJson(request, 4096)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value
  const targetUserId = (typeof body.targetUserId === "string" ? body.targetUserId : typeof body.userId === "string" ? body.userId : "").trim()
  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: "TARGET_REQUIRED" }, { status: 400 })
  }
  if (targetUserId === auth.userId) {
    return NextResponse.json({ ok: false, error: "SELF" }, { status: 400 })
  }
  const block = body.block !== false && body.block !== "false"

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Block", { extra: { blocked: block } })
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_block_set", {
    p_blocker_id: auth.userId,
    p_blocked_id: targetUserId,
    p_block: block,
  })
  const data = result.data as { ok?: boolean; error?: string; blocked?: boolean }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "BLOCK_FAILED" },
      { status: 503 }
    )
  }
  void appendSecurityEvent({ eventType: "social.block", outcome: "allowed", actorUserId: auth.userId, targetUserId, correlationId, metadata: { blocked: data?.blocked ?? block } })
  return NextResponse.json({
    ok: true,
    durable: true,
    blocked: data?.blocked ?? block,
  })
}
