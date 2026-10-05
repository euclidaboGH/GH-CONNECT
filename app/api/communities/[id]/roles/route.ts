/**
 * POST /api/communities/[id]/roles
 * Body: { targetUserId, role: "admin"|"moderator"|"member" }
 * Actor must be owner or admin. Cannot change owner or self.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"

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
  const body = await request.json().catch(() => ({}))
  const targetUserId = String(body.targetUserId || body.userId || "").trim()
  const role = String(body.role || "").trim().toLowerCase()
  // Ownership transfer is not available via this endpoint — prevents client owner injection
  const ALLOWED = new Set(["member", "moderator", "admin"])
  if (!communityId || !targetUserId || !role) {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 })
  }
  if (!ALLOWED.has(role)) {
    return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400 })
  }
  if (targetUserId === auth.userId) {
    return NextResponse.json({ ok: false, error: "SELF_ROLE" }, { status: 403 })
  }
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Community role", { extra: { role } })
    return NextResponse.json(nd.body, { status: nd.status })
  }
  const result = await socialRpc("gh_community_set_role", {
    p_community_id: communityId,
    p_actor_id: auth.userId,
    p_target_id: targetUserId,
    p_role: role,
  })
  const data = result.data as { ok?: boolean; error?: string; role?: string }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "ROLE_FAILED"
    const status =
      code === "FORBIDDEN" || code === "SELF_ROLE" || code === "CANNOT_CHANGE_OWNER"
        ? 403
        : 400
    return NextResponse.json({ ok: false, error: code }, { status })
  }
  return NextResponse.json({ ok: true, durable: true, role: data?.role || role })
}
