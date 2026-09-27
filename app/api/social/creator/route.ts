/**
 * GET  /api/social/creator — own creator profile + content list
 * POST /api/social/creator — enable/update own creator profile
 * No financial side effects.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  getCreatorProfile,
  listCreatorPosts,
  upsertCreatorProfile,
} from "@/lib/server/creator/store"
import { getReputationState } from "@/lib/server/reputation/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const profile = await getCreatorProfile(auth.userId)
  const posts = await listCreatorPosts(auth.userId)
  const rep = await getReputationState(auth.userId)

  return NextResponse.json({
    ok: true,
    durable: profile.ok && profile.exists !== false,
    creator: profile.ok
      ? {
          exists: Boolean(profile.exists),
          userId: auth.userId,
          displayName: profile.displayName ?? null,
          tagline: profile.tagline ?? null,
          bio: profile.bio ?? null,
          isEnabled: profile.isEnabled ?? false,
          tipsEnabled: profile.tipsEnabled ?? false,
        }
      : { exists: false, userId: auth.userId },
    posts: posts.ok ? posts.posts : [],
    reputation:
      rep.ok
        ? {
            level: rep.level,
            levelName: rep.levelName,
            totalPoints: rep.totalPoints,
          }
        : null,
    settlement: "tips_deferred",
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`creator:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  let body: {
    displayName?: string
    tagline?: string
    bio?: string
    tipsEnabled?: boolean
    userId?: string
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  // Ignore body.userId — session only
  const result = await upsertCreatorProfile({
    userId: auth.userId,
    displayName: body.displayName,
    tagline: body.tagline,
    bio: body.bio,
    tipsEnabled: Boolean(body.tipsEnabled),
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.error === "DB_UNAVAILABLE" ? 503 : 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    userId: auth.userId,
    tipsEnabled: result.tipsEnabled ?? false,
  })
}
