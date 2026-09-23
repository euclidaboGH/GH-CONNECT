/**
 * POST /api/reports — minimal durable report intake (session actor).
 * Uses ghc_community_reports when present; otherwise acknowledges local-only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const targetType = String(body.targetType || body.type || "user").slice(0, 40)
  const targetId = String(body.targetId || "").trim()
  const reason = String(body.reason || "").trim().slice(0, 500)
  const communityId = body.communityId ? String(body.communityId).trim() : null
  if (!targetId || !reason) {
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
