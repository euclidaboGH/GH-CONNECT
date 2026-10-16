/**
 * POST /api/social/blocks — { targetUserId, block: boolean }
 * Actor always from session.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const targetUserId = String(body.targetUserId || body.userId || "").trim()
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
  return NextResponse.json({
    ok: true,
    durable: true,
    blocked: data?.blocked ?? block,
  })
}
