import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { enqueueDomainEvent } from "@/lib/server/domain-events/outbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const query = `gh_reputation_appeals?user_id=eq.${encodeURIComponent(auth.userId)}&select=id,target_event_id,category,explanation,status,resolution_note,created_at,updated_at&order=created_at.desc&limit=50`
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${query}`, {
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store",
    })
    if (!response.ok) return NextResponse.json({ ok: false, error: "APPEAL_HISTORY_UNAVAILABLE" }, { status: 503 })
    return NextResponse.json({ ok: true, appeals: await response.json() }, { headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "APPEAL_HISTORY_UNAVAILABLE" }, { status: 503 }) }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`reputation-appeal:${auth.userId}`, 3, 60 * 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const categories = new Set(["incorrect_penalty", "wrong_identity", "duplicate_event", "context_missing", "other"])
  const category = String(body.category || "other")
  const explanation = String(body.explanation || "").trim()
  const targetEventId = String(body.targetEventId || "").trim()
  if (!categories.has(category) || explanation.length < 20 || explanation.length > 3000 || targetEventId.length > 256) {
    return NextResponse.json({ ok: false, error: "INVALID_APPEAL" }, { status: 400 })
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_reputation_appeals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ user_id: auth.userId, target_event_id: targetEventId || null, category, explanation }),
    })
    const data = await response.json().catch(() => null) as Array<Record<string, unknown>> | Record<string, unknown> | null
    if (!response.ok || !data) return NextResponse.json({ ok: false, error: "APPEAL_CREATE_FAILED" }, { status: 503 })
    const appeal = Array.isArray(data) ? data[0] : data
    const id = String(appeal?.id || "")
    if (id) void enqueueDomainEvent({
      eventType: "reputation.appeal_submitted",
      idempotencyKey: `reputation.appeal:${id}`,
      aggregateType: "reputation_appeal",
      aggregateId: id,
      actorId: auth.userId,
      payload: { userId: auth.userId, category, status: "open" },
    })
    return NextResponse.json({ ok: true, appeal }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "APPEAL_CREATE_FAILED" }, { status: 503 }) }
}
