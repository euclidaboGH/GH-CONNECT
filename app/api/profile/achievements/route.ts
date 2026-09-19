/**
 * GET /api/profile/achievements — list server unlocks + progress for auth user.
 * POST — idempotent unlock only when server evaluates eligibility (body.achievementId).
 * Does not mint GHC or change membership.
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  listAchievementsForUser,
  unlockAchievement,
  getProgress,
  isAchievementStoreDurable,
} from "@/lib/server/identity/achievement-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const [achievements, progress] = await Promise.all([
      listAchievementsForUser(auth.userId),
      getProgress(auth.userId),
    ])
    return NextResponse.json(
      {
        ok: true,
        durable: isAchievementStoreDurable(),
        achievements,
        progress,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[profile/achievements GET]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "ACHIEVEMENTS_LOAD_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const body = await request.json().catch(() => ({}))
    const achievementId =
      typeof body?.achievementId === "string" ? body.achievementId.trim() : ""
    if (!achievementId) {
      return NextResponse.json(
        { ok: false, error: "ACHIEVEMENT_ID_REQUIRED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    // Catalog-lite allowlist: alphanumeric + underscore only (prevents garbage writes)
    if (!/^[a-z0-9_]{2,80}$/i.test(achievementId)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ACHIEVEMENT_ID" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const sourceEvent =
      typeof body?.sourceEvent === "string" ? body.sourceEvent.slice(0, 120) : null

    const unlocked = await unlockAchievement({
      ghUserId: auth.userId,
      achievementId,
      sourceEvent,
    })
    if (!unlocked) {
      return NextResponse.json(
        { ok: false, error: "ACHIEVEMENT_PERSIST_FAILED" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(
      {
        ok: true,
        durable: isAchievementStoreDurable(),
        achievement: unlocked,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[profile/achievements POST]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "ACHIEVEMENT_UNLOCK_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
