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
    const query = `gh_reward_risk_holds?user_id=eq.${encodeURIComponent(auth.userId)}&select=id,source_event_id,reason_code,status,created_at,resolved_at&order=created_at.desc&limit=100`
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${query}`, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" })
    if (!response.ok) return NextResponse.json({ ok: false, error: "REWARD_HOLDS_UNAVAILABLE" }, { status: 503 })
    return NextResponse.json({ ok: true, holds: await response.json(), appealEndpoint: "/api/economy/rewards/appeals" }, { headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "REWARD_HOLDS_UNAVAILABLE" }, { status: 503 }) }
}
