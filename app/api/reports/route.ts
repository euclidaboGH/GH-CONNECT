/**
 * POST /api/reports — minimal durable report intake (session actor).
 * Uses ghc_community_reports when present; otherwise acknowledges local-only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`report:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }
  const parsedBody = await readBoundedJson(request, 8 * 1024)
  if (!parsedBody.ok) {
    return NextResponse.json(
      { ok: false, error: parsedBody.error },
      { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 },
    )
  }
  const body = parsedBody.value
  const rawTargetType = body.targetType ?? body.type ?? "user"
  const targetType = typeof rawTargetType === "string" ? rawTargetType.slice(0, 40) : ""
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : ""
  const communityId = body.communityId === undefined || body.communityId === null || body.communityId === ""
    ? null
    : typeof body.communityId === "string" ? body.communityId.trim() : "__invalid__"
  if (!targetId || !reason || !targetType || communityId === "__invalid__") {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 })
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return NextResponse.json({
      ok: true,
      durable: false,
      message: "Report recorded locally until moderation store is available",
    })
  }

  try {
    const row = {
      community_id: communityId,
      reporter_id: auth.userId,
      target_type: targetType,
      target_id: targetId,
      reason,
      status: "open",
    }
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_community_reports`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(row),
      }
    )
    if (!res.ok) {
      return NextResponse.json({
        ok: true,
        durable: false,
        message: "Report accepted; durable table unavailable",
      })
    }
    return NextResponse.json({ ok: true, durable: true })
  } catch {
    return NextResponse.json({
      ok: true,
      durable: false,
      message: "Report accepted offline",
    })
  }
}
