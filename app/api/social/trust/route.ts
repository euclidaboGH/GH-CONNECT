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
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_trust_dimensions_get`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_user_id: auth.userId }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) return NextResponse.json({ ok: false, error: "TRUST_READ_FAILED" }, { status: 503 })
    return NextResponse.json({ ok: true, dimensions: result.dimensions || {}, eventCount: Number(result.eventCount) || 0, authority: "verified-events-only", privilegeEffect: "none-by-default" }, { headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "TRUST_READ_FAILED" }, { status: 503 }) }
}
