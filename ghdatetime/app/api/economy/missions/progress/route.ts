/**
 * POST /api/economy/missions/progress
 * Fail-closed until completion can be verified and claimed atomically in durable storage.
 * A client-supplied mission code is not evidence of a completed action.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { activityRewardsEnabled } from "@/lib/server/economy/testnet-unlock"

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

  const activityOn = activityRewardsEnabled()

  // A mission code submitted by a client is not proof that the user performed
  // the action. This endpoint currently has no durable mission-verification RPC
  // that checks the corresponding community/post/comment/profile/connection row
  // and claims the mission once. Do not issue GHC or report a verified completion
  // until that authority exists. This avoids reward farming by replaying any code.
  if (activityOn) {
    return NextResponse.json(
      {
        ok: false,
        completed: false,
        verified: false,
        grantedGhc: 0,
        error: "MISSION_VERIFICATION_UNAVAILABLE",
        message: "Mission rewards are paused until server-side completion verification and one-time claim storage are configured. No GHC was issued.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    {
      ok: false,
      completed: false,
      verified: false,
      grantedGhc: 0,
      error: "MISSION_PROGRESS_NOT_PERSISTED",
      message: "Mission progress cannot yet be confirmed by the server. No completion or reward has been recorded.",
      policy: "progress_only_unavailable",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  )
}
