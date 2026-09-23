/**
 * GET  /api/social/follows — following + followers for session user
 * POST /api/social/follows — { targetUserId, follow: boolean }
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      following: [],
      followers: [],
    })
  }
  const result = await socialRpc("gh_follow_list", { p_user_id: auth.userId })
  const data = result.data as {
    following?: string[]
    followers?: string[]
  }
  return NextResponse.json({
    ok: true,
    durable: result.ok,
    following: Array.isArray(data?.following) ? data.following : [],
    followers: Array.isArray(data?.followers) ? data.followers : [],
  })
}

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
  const follow = body.follow !== false && body.follow !== "false"

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, following: follow })
  }

  const result = await socialRpc("gh_follow_set", {
    p_follower_id: auth.userId,
    p_following_id: targetUserId,
    p_follow: follow,
  })
  const data = result.data as { ok?: boolean; error?: string; following?: boolean }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "FOLLOW_FAILED"
    const status = code === "BLOCKED" || code === "SELF" ? 400 : 503
    return NextResponse.json({ ok: false, error: code }, { status })
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    following: data?.following ?? follow,
  })
}
