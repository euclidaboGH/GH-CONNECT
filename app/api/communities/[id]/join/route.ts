/**
 * POST /api/communities/[id]/join — join or request (session user)
 * DELETE /api/communities/[id]/join — leave (session user; not owner)
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(_request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id } = await ctx.params
  const communityId = String(id || "").trim()
  if (!communityId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, status: "active" })
  }
  const result = await socialRpc("gh_community_join", {
    p_community_id: communityId,
    p_user_id: auth.userId,
  })
  const data = result.data as { ok?: boolean; status?: string; error?: string }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "JOIN_FAILED"
    const status =
      code === "BANNED" ? 403 : code === "NOT_FOUND" ? 404 : 503
    return NextResponse.json({ ok: false, error: code }, { status })
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    status: data?.status || "active",
  })
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(_request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id } = await ctx.params
  const communityId = String(id || "").trim()
  if (!communityId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false })
  }
  const result = await socialRpc("gh_community_leave", {
    p_community_id: communityId,
    p_user_id: auth.userId,
  })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "LEAVE_FAILED" },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true, durable: true })
}
