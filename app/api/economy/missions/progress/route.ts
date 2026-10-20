/**
 * POST /api/economy/missions/progress
 * Records mission completion. Optional small GHC via activity emission when
 * GHC_ACTIVITY_REWARDS_ENABLED=1.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { isDatabaseConfigured } from "@/lib/server/economy/http"
import { computeAndCommitActivityEmissionDurable } from "@/lib/server/economy/activity-emission"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED = new Set([
  "join_community",
  "first_post",
  "first_comment",
  "complete_profile",
  "send_connection",
  "accept_connection",
])

const BASE_GHC: Record<string, number> = {
  join_community: 0.15,
  first_post: 0.25,
  first_comment: 0.1,
  complete_profile: 0.2,
  send_connection: 0.1,
  accept_connection: 0.1,
}

export async function POST(req: Request) {
  const auth = await resolveAuthenticatedUser(req.headers)
  if (!auth?.userId) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string }
  const code = String(body.code || "").trim()
  if (!ALLOWED.has(code)) {
    return NextResponse.json({ ok: false, error: "INVALID_MISSION" }, { status: 400 })
  }

  const activityOn =
    String(process.env.GHC_ACTIVITY_REWARDS_ENABLED || "").trim() === "1"

  if (activityOn && isDatabaseConfigured()) {
    try {
      const base = BASE_GHC[code] ?? 0.1
      const result = await computeAndCommitActivityEmissionDurable({
        userId: auth.userId,
        baseAmountGhc: base,
      })
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          completed: true,
          alreadyCompleted: Boolean(result.capped && result.grantedGhc === 0),
          grantedGhc: result.grantedGhc,
          message:
            result.grantedGhc > 0
              ? `Mission complete · ₲ ${result.grantedGhc.toFixed(2)} credited`
              : "Mission recorded (activity cap or already counted today)",
        })
      }
    } catch {
      /* progress-only */
    }
  }

  return NextResponse.json({
    ok: true,
    completed: true,
    alreadyCompleted: false,
    grantedGhc: 0,
    message: activityOn
      ? "Mission recorded"
      : "Mission complete — set GHC_ACTIVITY_REWARDS_ENABLED=1 on Vercel to credit activity GHC",
    policy: activityOn ? "activity_enabled" : "progress_only",
  })
}
