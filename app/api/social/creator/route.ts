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
  getCreatorEconomySummary,
  upsertCreatorProfile,
} from "@/lib/server/creator/store"
import { getReputationState } from "@/lib/server/reputation/store"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

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
  const postRows = posts.ok ? posts.posts : []
  const postIds = postRows.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const id = (row as { id?: unknown }).id
    return typeof id === "string" && id ? [id] : []
  })
  const economy = await getCreatorEconomySummary(auth.userId, postIds)

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
    posts: postRows,
    creatorEconomy: economy,
    reputation:
      rep.ok
        ? {
            level: rep.level,
            levelName: rep.levelName,
            totalPoints: rep.totalPoints,
          }
        : null,
    settlement: "server_authoritative",
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

  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const body = parsedBody.value as {
    displayName?: string
    tagline?: string
    bio?: string
    tipsEnabled?: boolean
    userId?: string
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
