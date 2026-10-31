import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 })
  const url = new URL(request.url)
  const after = Math.max(0, Number(url.searchParams.get("afterSequence") || 0) || 0)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 80) || 80))
  try {
    const q = new URL(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_realtime_events`)
    q.searchParams.set("recipient_user_id", `eq.${auth.userId}`)
    q.searchParams.set("id", `gt.${after}`)
    q.searchParams.set("order", "id.asc")
    q.searchParams.set("limit", String(limit + 1))
    q.searchParams.set("select", "id,event_id,actor_user_id,event_type,aggregate_type,aggregate_id,correlation_id,request_id,payload,created_at,expires_at")
    const res = await fetch(q.toString(), { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" })
    if (!res.ok) return NextResponse.json({ ok: false, error: `HTTP_${res.status}` }, { status: 503 })
    const rows = (await res.json()) as Array<Record<string, unknown>>
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit).map((r) => ({
      sequence: String(r.id), eventId: String(r.event_id), actorId: String(r.actor_user_id || "system"),
      type: String(r.event_type), aggregateType: String(r.aggregate_type || "system"),
      aggregateId: r.aggregate_id ? String(r.aggregate_id) : undefined,
      correlationId: r.correlation_id ? String(r.correlation_id) : undefined,
      requestId: r.request_id ? String(r.request_id) : undefined,
      payload: r.payload && typeof r.payload === "object" ? r.payload : {},
      at: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
      expiresAt: r.expires_at ? new Date(String(r.expires_at)).getTime() : undefined,
    }))
    const nextSequence = page.length ? page[page.length - 1].sequence : String(after)
    return NextResponse.json({ ok: true, events: page, hasMore, nextSequence })
  } catch {
    return NextResponse.json({ ok: false, error: "RECOVERY_FAILED" }, { status: 503 })
  }
}
