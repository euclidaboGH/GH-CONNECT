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
    const query = `gh_reward_appeals?user_id=eq.${encodeURIComponent(auth.userId)}&select=id,source_event_id,category,explanation,status,resolution_note,created_at,updated_at&order=created_at.desc&limit=50`
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
  const rl = checkRateLimit(`reward-appeal:${auth.userId}`, 3, 60 * 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const sourceEventId = String(body.sourceEventId || "").trim()
  const category = String(body.category || "other")
  const explanation = String(body.explanation || "").trim()
  const allowed = new Set(["missing_reward", "incorrect_amount", "false_positive_hold", "settlement_delay", "other"])
  if (!sourceEventId || sourceEventId.length > 256 || !allowed.has(category) || explanation.length < 20 || explanation.length > 3000) {
    return NextResponse.json({ ok: false, error: "INVALID_APPEAL" }, { status: 400 })
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_reward_appeals`, {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ user_id: auth.userId, source_event_id: sourceEventId, category, explanation }),
    })
    const data = await response.json().catch(() => null) as Array<Record<string, unknown>> | null
    if (!response.ok || !Array.isArray(data) || !data[0]) return NextResponse.json({ ok: false, error: response.status === 409 ? "APPEAL_ALREADY_EXISTS" : "APPEAL_CREATE_FAILED" }, { status: response.status === 409 ? 409 : 503 })
    const appeal = data[0]
    await enqueueDomainEvent({ eventType: "reward.appeal_submitted", idempotencyKey: `reward.appeal:${appeal.id}`, aggregateType: "reward_appeal", aggregateId: String(appeal.id), actorId: auth.userId, payload: { userId: auth.userId, sourceEventId, category, status: "open" } })
    return NextResponse.json({ ok: true, appeal }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "APPEAL_CREATE_FAILED" }, { status: 503 }) }
}
