/**
 * GET  /api/social/reputation - own reputation state (session)
 * POST /api/social/reputation - claim ONLY server-proven catalog events
 *
 * Trust signal only. Client cannot supply points, level, or target user.
 * Event type alone is NOT proof - server verifies authoritative records.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { isReputationEventType } from "@/lib/server/reputation/config"
import {
  applyReputationEvent,
  getReputationState,
} from "@/lib/server/reputation/store"
import {
  CLIENT_AWARDABLE_EVENTS,
  forcedIdempotencyKey,
  verifyFirstPost,
  verifyProfileComplete,
} from "@/lib/server/reputation/verify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const state = await getReputationState(auth.userId)
  if (!state.ok) {
    if (state.error === "DB_UNAVAILABLE") {
      return NextResponse.json({
        ok: true,
        durable: false,
        totalPoints: 0,
        level: 1,
        levelName: "Seed",
        reason: "DB_UNAVAILABLE",
      })
    }
    return NextResponse.json({ ok: false, error: state.error }, { status: 503 })
  }

  return NextResponse.json({
    ok: true,
    durable: true,
    userId: state.userId,
    totalPoints: state.totalPoints,
    level: state.level,
    levelName: state.levelName,
    levelId: state.levelId,
    eventCount: state.eventCount,
    updatedAt: state.updatedAt,
    nextLevel: state.nextLevel,
    pointsToNext: state.pointsToNext,
    progressRatio: state.progressRatio,
    sustainabilityGate: state.sustainabilityGate,
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`reputation:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    )
  }

  let body: {
    eventType?: string
    idempotencyKey?: string
    sourceRef?: string
    userId?: string
    points?: number
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  if (!isReputationEventType(body.eventType)) {
    return NextResponse.json({ ok: false, error: "INVALID_EVENT_TYPE" }, { status: 400 })
  }

  const eventType = body.eventType
  if (!CLIENT_AWARDABLE_EVENTS.includes(eventType as (typeof CLIENT_AWARDABLE_EVENTS)[number])) {
    return NextResponse.json(
      {
        ok: false,
        error: "EVENT_NOT_CLIENT_AWARDABLE",
        message:
          "This event can only be granted by a server-side integration after authoritative proof.",
      },
      { status: 403 }
    )
  }

  const idem = forcedIdempotencyKey(
    eventType as "profile_complete" | "first_post",
    auth.userId
  )
  if (!idem) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_CLIENT_AWARDABLE" }, { status: 403 })
  }

  let sourceRef: string | undefined
  if (eventType === "profile_complete") {
    const proof = await verifyProfileComplete(auth.userId)
    if (!proof.ok) {
      return NextResponse.json(
        { ok: false, error: proof.error || "PROOF_FAILED" },
        { status: 400 }
      )
    }
    sourceRef = `profile:${auth.userId}`
  } else if (eventType === "first_post") {
    const proof = await verifyFirstPost(auth.userId)
    if (!proof.ok) {
      return NextResponse.json(
        { ok: false, error: proof.error || "PROOF_FAILED" },
        { status: 400 }
      )
    }
    sourceRef = `post:${proof.postId}`
  } else {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_CLIENT_AWARDABLE" }, { status: 403 })
  }

  const result = await applyReputationEvent({
    userId: auth.userId,
    eventType,
    idempotencyKey: idem,
    sourceRef,
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
    duplicate: result.duplicate,
    eventId: result.eventId,
    totalPoints: result.totalPoints,
    level: result.level,
    levelName: result.levelName,
    eventCount: result.eventCount,
  })
}
