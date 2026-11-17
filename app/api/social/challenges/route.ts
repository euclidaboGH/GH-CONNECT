import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const SAFE_ID = /^[0-9a-f-]{36}$/i


export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`social-challenge-status:${auth.userId}`, 120, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const url = new URL(request.url)
  const challengeId = url.searchParams.get("challengeId") || ""
  if (!SAFE_ID.test(challengeId) || !getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "CHALLENGE_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const result = await supabaseRest<Array<{ status: string }>>(`gh_social_challenge_participants?challenge_id=eq.${challengeId}&user_id=eq.${encodeURIComponent(auth.userId)}&select=status&limit=1`)
  if (!result.ok) return NextResponse.json({ ok: false, error: "CHALLENGE_STATUS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const status = result.data?.[0]?.status || null
  return NextResponse.json({ ok: true, joined: status === "joined" || status === "active" || status === "completed", status }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const body = parsed.value as Record<string, unknown>
  const action = String(body.action || "")
  const rate = await checkDurableRateLimit(`social-challenge:${action}:${auth.userId}`, action === "join" ? 40 : 12, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "CHALLENGE_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })

  if (action === "create") {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : ""
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : ""
    const metric = typeof body.metric === "string" ? body.metric.trim().toLowerCase() : ""
    const target = Number(body.target)
    const durationDays = Number(body.durationDays)
    const visibility = String(body.visibility || "public")
    if (title.length < 4 || !/^[a-z][a-z0-9_]{1,40}$/.test(metric) || !Number.isInteger(target) || target < 1 || target > 1_000_000 || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365 || !["public", "followers", "community", "invite_only", "private"].includes(visibility)) {
      return NextResponse.json({ ok: false, error: "INVALID_CHALLENGE" }, { status: 400, headers: NO_STORE })
    }
    const id = randomUUID()
    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + durationDays * 86_400_000)
    const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_social_challenges?select=id,title,description,metric,target,duration_days,visibility,status,starts_at,ends_at", {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ id, author_user_id: auth.userId, title, description, metric, target, duration_days: durationDays, visibility, status: "open", starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() }), timeoutMs: 10_000,
    })
    if (!saved.ok || !saved.data?.[0]) return NextResponse.json({ ok: false, error: "CHALLENGE_CREATE_FAILED" }, { status: 503, headers: NO_STORE })
    const joined = await supabaseRest<{ ok?: boolean }>("rpc/gh_social_challenge_participate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_challenge_id: id, p_user_id: auth.userId, p_action: "join" }) })
    if (!joined.ok || joined.data?.ok !== true) {
      await supabaseRest(`gh_social_challenges?id=eq.${id}&author_user_id=eq.${encodeURIComponent(auth.userId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }) })
      return NextResponse.json({ ok: false, error: "CHALLENGE_PARTICIPATION_INIT_FAILED" }, { status: 503, headers: NO_STORE })
    }
    return NextResponse.json({ ok: true, challenge: saved.data[0] }, { status: 201, headers: NO_STORE })
  }

  const challengeId = String(body.challengeId || "")
  if (!SAFE_ID.test(challengeId)) return NextResponse.json({ ok: false, error: "CHALLENGE_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const challenge = await supabaseRest<Array<{ id: string; status: string; ends_at: string; visibility: string; author_user_id: string }>>(`gh_social_challenges?id=eq.${challengeId}&select=id,status,ends_at,visibility,author_user_id&limit=1`)
  if (!challenge.ok || !challenge.data?.[0]) return NextResponse.json({ ok: false, error: "CHALLENGE_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const row = challenge.data[0]
  if (action === "join") {
    if (row.visibility !== "public" && row.author_user_id !== auth.userId) return NextResponse.json({ ok: false, error: "CHALLENGE_NOT_OPEN_TO_USER" }, { status: 403, headers: NO_STORE })
    if (row.status !== "open" || Date.parse(row.ends_at) <= Date.now()) return NextResponse.json({ ok: false, error: "CHALLENGE_CLOSED" }, { status: 409, headers: NO_STORE })
    const joined = await supabaseRest<{ ok?: boolean; error?: string }>("rpc/gh_social_challenge_participate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_challenge_id: challengeId, p_user_id: auth.userId, p_action: "join" }) })
    if (!joined.ok) return NextResponse.json({ ok: false, error: "CHALLENGE_JOIN_FAILED" }, { status: joined.status >= 400 && joined.status < 500 ? joined.status : 503, headers: NO_STORE })
    if (joined.data?.ok !== true) return NextResponse.json({ ok: false, error: joined.data?.error || "CHALLENGE_JOIN_FAILED" }, { status: joined.data?.error === "CHALLENGE_CLOSED" ? 409 : 503, headers: NO_STORE })
    return NextResponse.json({ ok: true, joined: true }, { headers: NO_STORE })
  }
  if (action === "leave") {
    const left = await supabaseRest<{ ok?: boolean }>("rpc/gh_social_challenge_participate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_challenge_id: challengeId, p_user_id: auth.userId, p_action: "leave" }) })
    if (!left.ok || left.data?.ok !== true) return NextResponse.json({ ok: false, error: "CHALLENGE_LEAVE_FAILED" }, { status: 503, headers: NO_STORE })
    return NextResponse.json({ ok: true, joined: false }, { headers: NO_STORE })
  }
  if (action === "cancel") {
    const cancelled = await supabaseRest<{ ok?: boolean; error?: string }>("rpc/gh_social_challenge_participate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_challenge_id: challengeId, p_user_id: auth.userId, p_action: "cancel" }) })
    if (!cancelled.ok || cancelled.data?.ok !== true) return NextResponse.json({ ok: false, error: "CHALLENGE_NOT_FOUND" }, { status: 404, headers: NO_STORE })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }
  return NextResponse.json({ ok: false, error: "UNSUPPORTED_ACTION" }, { status: 400, headers: NO_STORE })
}
