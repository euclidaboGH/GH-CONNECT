/**
 * GET  /api/social/follows
 *   - no query: session user's following + followers lists
 *   - ?targetUserId=: authoritative status + counts for that user
 * POST /api/social/follows — { targetUserId, follow: boolean }
 *   Actor is always the session user. Client follower IDs ignored.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { emitSocialNotification } from "@/lib/server/social/notifications"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const url = new URL(request.url)
  const targetUserId = String(url.searchParams.get("targetUserId") || "").trim()

  if (!socialDbConfigured()) {
    if (targetUserId) {
      return NextResponse.json({
        ok: true,
        durable: false,
        targetUserId,
        isFollowing: false,
        blocked: false,
        followersCount: 0,
        followingCount: 0,
      })
    }
    return NextResponse.json({
      ok: true,
      durable: false,
      following: [],
      followers: [],
      followingCount: 0,
      followersCount: 0,
    })
  }

  if (targetUserId) {
    const result = await socialRpc("gh_follow_status", {
      p_actor_id: auth.userId,
      p_target_id: targetUserId,
    })
    const data = (result.data || {}) as Record<string, unknown>
    if (!result.ok || data.ok === false) {
      return NextResponse.json(
        { ok: false, error: String(data.error || result.error || "STATUS_FAILED") },
        { status: 503 }
      )
    }
    return NextResponse.json({
      ok: true,
      durable: true,
      targetUserId: String(data.targetUserId || targetUserId),
      isFollowing: Boolean(data.isFollowing),
      blocked: Boolean(data.blocked),
      followersCount: Number(data.followersCount) || 0,
      followingCount: Number(data.followingCount) || 0,
    })
  }

  const result = await socialRpc("gh_follow_list", { p_user_id: auth.userId })
  const data = result.data as { following?: string[]; followers?: string[] }
  const following = Array.isArray(data?.following) ? data.following : []
  const followers = Array.isArray(data?.followers) ? data.followers : []
  return NextResponse.json({
    ok: true,
    durable: result.ok,
    following,
    followers,
    followingCount: following.length,
    followersCount: followers.length,
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`follow:${auth.userId}`, 40, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  // Ignore body.followerId / body.actorId entirely
  void body.followerId
  void body.actorId
  void body.userId

  const targetUserId = String(body.targetUserId || "").trim()
  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: "TARGET_REQUIRED" }, { status: 400 })
  }
  if (targetUserId === auth.userId) {
    return NextResponse.json({ ok: false, error: "SELF" }, { status: 400 })
  }

  const follow = body.follow !== false && body.follow !== "false"

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Follow", { extra: { following: follow, targetUserId } })
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_follow_set", {
    p_follower_id: auth.userId,
    p_following_id: targetUserId,
    p_follow: follow,
  })
  const data = (result.data || {}) as { ok?: boolean; error?: string; following?: boolean }
  if (!result.ok || data?.ok === false) {
    const code = String(data?.error || result.error || "FOLLOW_FAILED")
    const status = code === "BLOCKED" || code === "SELF" ? 400 : 503
    return NextResponse.json({ ok: false, error: code }, { status })
  }

  // Refresh compact counts for target
  let followersCount: number | undefined
  let followingCount: number | undefined
  const status = await socialRpc("gh_follow_status", {
    p_actor_id: auth.userId,
    p_target_id: targetUserId,
  })
  if (status.ok && status.data && typeof status.data === "object") {
    const s = status.data as Record<string, unknown>
    followersCount = Number(s.followersCount) || 0
    followingCount = Number(s.followingCount) || 0
  }

  if (follow && (data?.following ?? follow)) {
    void emitSocialNotification({
      recipientUserId: targetUserId,
      actorUserId: auth.userId,
      type: "follow",
      entityType: "user",
      entityId: auth.userId,
      title: "New follower",
      body: "Someone started following you",
      dedupeKey: `follow:${auth.userId}:${targetUserId}`,
      metadata: { actorUserId: auth.userId },
    })
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    targetUserId,
    following: data?.following ?? follow,
    followersCount,
    followingCount,
  })
}
