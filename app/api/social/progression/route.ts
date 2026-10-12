import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_progression_get`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_user_id: auth.userId, p_limit: 50 }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) return NextResponse.json({ ok: false, error: "PROGRESSION_READ_FAILED" }, { status: 503 })
    return NextResponse.json({ ok: true, authoritative: true, totalXp: Number(result.totalXp) || 0, level: Number(result.level) || 1, nextLevel: result.nextLevel ?? null, pointsToNext: Number(result.pointsToNext) || 0, progressRatio: Number(result.progressRatio) || 0, rulesVersion: result.rulesVersion || "progression-v1", events: Array.isArray(result.events) ? result.events : [] }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, error: "PROGRESSION_READ_FAILED" }, { status: 503 })
  }
}

/** Client-facing XP claims are intentionally rejected; trusted server integrations call the award RPC. */
export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  return NextResponse.json({ ok: false, error: "SERVER_VERIFIED_EVENT_REQUIRED", message: "XP is awarded only by server integrations after verifying the underlying action." }, { status: 403 })
}
