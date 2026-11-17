/**
 * GET  /api/social/creator — own creator profile + content list
 * POST /api/social/creator — enable/update own creator profile
 * No financial side effects.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
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
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie, Authorization" }
function reply(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = await checkDurableRateLimit(`creator-read:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate), { "Retry-After": String(rate.retryAfterSec) })

  const profile = await getCreatorProfile(auth.userId)
  const posts = await listCreatorPosts(auth.userId)
  const rep = await getReputationState(auth.userId)
  const postRows = posts.ok ? posts.posts : []
  const postIds = postRows.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const id = (row as { id?: unknown }).id
    return typeof id === "string" && id ? [id] : []
  })
  // Reward aggregation depends on the authoritative owned-post set. If that read
  // fails, do not query an empty ID list and misreport post rewards as zero.
  const economy = posts.ok ? await getCreatorEconomySummary(auth.userId, postIds) : null

  return reply({
    ok: true,
    durable: profile.ok && posts.ok,
    dataQuality: {
      complete: profile.ok && posts.ok && economy?.ok === true && rep.ok,
      sources: {
        creatorProfile: profile.ok,
        publishedPosts: posts.ok,
        creatorEconomy: economy?.ok === true,
        reputation: rep.ok,
      },
    },
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
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rl = await checkDurableRateLimit(`creator-write:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return reply({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, durableRateLimitStatus(rl), { "Retry-After": String(rl.retryAfterSec) })

  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
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
    return reply({ ok: false, error: result.error }, result.error === "DB_UNAVAILABLE" ? 503 : 400)
  }

  return reply({
    ok: true,
    durable: true,
    userId: auth.userId,
    tipsEnabled: result.tipsEnabled ?? false,
  })
}
