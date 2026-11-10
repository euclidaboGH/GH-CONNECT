/**
 * POST /api/communities/[id]/requests
 * Body: { applicantId, approve: boolean }
 * Actor must be owner/admin/moderator. Cannot self-approve.
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"
import { sanitizeCommunityId } from "@/lib/server/community/community-integrity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "communities/[id]/requests:POST", 60, 60_000, { failClosed: true })
  if (__rateLimited) return __rateLimited
  const { id } = await ctx.params
  const communityId = sanitizeCommunityId(id)
  if (!communityId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  const parsedBody = await readBoundedJson(request, 8192)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const body = parsedBody.value
  const applicantId = String(body.applicantId || body.userId || "").trim()
  if (!applicantId || applicantId.length > 160 || /[\u0000-\u001f\u007f]/.test(applicantId)) {
    return NextResponse.json({ ok: false, error: "APPLICANT_REQUIRED" }, { status: 400 })
  }
  if (applicantId === auth.userId) {
    return NextResponse.json({ ok: false, error: "SELF_DECIDE" }, { status: 400 })
  }
  if (typeof body.approve !== "boolean") {
    return NextResponse.json({ ok: false, error: "APPROVAL_DECISION_REQUIRED" }, { status: 400, headers: { "Cache-Control": "no-store, private" } })
  }
  const approve = body.approve

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Community join decide", {
      extra: { status: "unavailable" },
    })
    return NextResponse.json(nd.body, { status: nd.status })
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
  const status = data?.status || (approve ? "active" : "rejected")
  return NextResponse.json({
    ok: true,
    durable: true,
    status,
  })
}
