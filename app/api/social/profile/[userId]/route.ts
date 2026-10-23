/**
 * GET /api/social/profile/:userId
 * Canonical viewer-authorized public identity projection.
 * The session is the viewer; the target identity is loaded from the durable profile store.
 * Private economy/membership data is never returned.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getServerProfile, serverProfileToClientPartial, isProfileStoreDurable } from "@/lib/server/identity/profile-store"
import { getReputationState } from "@/lib/server/reputation/store"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { projectPublicProfile, type ServerPrivacySettings } from "@/lib/server/privacy-feed-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function privacyFromPayload(payload: Record<string, unknown>): Partial<ServerPrivacySettings> {
  const raw = (payload.privacySettings && typeof payload.privacySettings === "object")
    ? payload.privacySettings as Record<string, unknown>
    : (payload.privacy && typeof payload.privacy === "object")
      ? payload.privacy as Record<string, unknown>
      : {}
  return {
    profileVisibility: raw.profileVisibility === "hidden" || raw.profileVisibility === "matches-only" ? raw.profileVisibility : "everyone",
    showActivity: raw.showActivity !== false,
    showInterests: raw.showInterests !== false,
    showCommunities: raw.showCommunities !== false,
    showLocation: raw.showLocation !== false,
    onlineStatus: raw.onlineStatus === "hidden" || raw.onlineStatus === "matches-only" ? raw.onlineStatus : "everyone",
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const { userId: raw } = await ctx.params
  const targetUserId = String(raw || "").trim()
  if (!targetUserId || targetUserId.length > 160 || /[\u0000-\u001f\u007f]/.test(targetUserId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PROFILE_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const rl = checkRateLimit(`public-profile:${auth.userId}`, 120, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })

  const record = await getServerProfile(targetUserId)
  if (!record || !record.onboarded) return NextResponse.json({ ok: false, error: "PROFILE_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  const isOwner = auth.userId === targetUserId
  const privacy = privacyFromPayload(record.profilePayload || {})

  let relationship = { isFollowing: false, blocked: false, followersCount: 0, followingCount: 0 }
  if (socialDbConfigured()) {
    const status = await socialRpc("gh_follow_status", { p_actor_id: auth.userId, p_target_id: targetUserId })
    if (status.ok && status.data && typeof status.data === "object") {
      const s = status.data as Record<string, unknown>
      relationship = {
        isFollowing: Boolean(s.isFollowing), blocked: Boolean(s.blocked),
        followersCount: Math.max(0, Number(s.followersCount) || 0), followingCount: Math.max(0, Number(s.followingCount) || 0),
      }
    }
  }
  if (!isOwner && relationship.blocked) return NextResponse.json({ ok: false, error: "PROFILE_UNAVAILABLE" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  // matches-only remains fail-closed until GreenHaven has a canonical durable match relation.
  if (!isOwner && privacy.profileVisibility === "hidden") return NextResponse.json({ ok: false, error: "PROFILE_PRIVATE" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  if (!isOwner && privacy.profileVisibility === "matches-only") return NextResponse.json({ ok: false, error: "PROFILE_PRIVATE" }, { status: 403, headers: { "Cache-Control": "no-store" } })

  const full = serverProfileToClientPartial(record)
  const profile = projectPublicProfile(full, {
    isOwner,
    showActivity: privacy.showActivity,
    showInterests: privacy.showInterests,
    showCommunities: privacy.showCommunities,
    showLocation: privacy.showLocation,
    onlineStatus: privacy.onlineStatus,
  })
  // Defense in depth: never expose extensible payload privacy/settings or economy-like keys.
  delete (profile as Record<string, unknown>).privacy
  delete (profile as Record<string, unknown>).privacySettings
  delete (profile as Record<string, unknown>).wallet
  delete (profile as Record<string, unknown>).membership
  delete (profile as Record<string, unknown>).balance

  const reputation = await getReputationState(targetUserId)
  const publicReputation = reputation.ok ? {
    level: reputation.level, levelName: reputation.levelName, totalPoints: reputation.totalPoints,
    eventCount: reputation.eventCount, progressRatio: reputation.progressRatio,
  } : null

  return NextResponse.json({
    ok: true, durable: isProfileStoreDurable(), profile, relationship,
    reputation: publicReputation,
    privacy: { activityVisible: privacy.showActivity !== false, interestsVisible: privacy.showInterests !== false, communitiesVisible: privacy.showCommunities !== false, locationVisible: privacy.showLocation !== false },
  }, { headers: { "Cache-Control": "no-store" } })
}
