/**
 * POST /api/communities/[id]/requests
 * Body: { applicantId, approve: boolean }
 * Actor must be owner/admin/moderator. Cannot self-approve.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id } = await ctx.params
  const communityId = String(id || "").trim()
  if (!communityId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const applicantId = String(body.applicantId || body.userId || "").trim()
  if (!applicantId) {
    return NextResponse.json({ ok: false, error: "APPLICANT_REQUIRED" }, { status: 400 })
  }
  if (applicantId === auth.userId) {
    return NextResponse.json({ ok: false, error: "SELF_DECIDE" }, { status: 400 })
  }
  const approve = body.approve !== false && body.approve !== "false"

  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      status: approve ? "active" : "rejected",
    })
  }

  const result = await socialRpc("gh_community_join_decide", {
    p_community_id: communityId,
    p_actor_id: auth.userId,
    p_applicant_id: applicantId,
    p_approve: approve,
  })
  const data = result.data as { ok?: boolean; error?: string; status?: string }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "DECIDE_FAILED"
    const status =
      code === "FORBIDDEN" || code === "SELF_DECIDE"
        ? 403
        : code === "NO_PENDING"
          ? 404
          : 503
    return NextResponse.json({ ok: false, error: code }, { status })
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    status: data?.status || (approve ? "active" : "rejected"),
  })
}
