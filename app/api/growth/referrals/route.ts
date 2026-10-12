import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requestRpc(name: string, args: Record<string, unknown>) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify(args), cache: "no-store",
    })
    if (!response.ok) return null
    return await response.json() as Record<string, unknown>
  } catch { return null }
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`growth-referrals:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  const codeResult = await requestRpc("gh_growth_referral_code_get_or_create", { p_user_id: auth.userId })
  if (!codeResult || codeResult.ok !== true) return NextResponse.json({ ok: false, error: "REFERRAL_DATABASE_UNAVAILABLE" }, { status: 503 })
  const env = readGhcServerEnv()
  try {
    const query = `gh_growth_referrals?referrer_id=eq.${encodeURIComponent(auth.userId)}&select=id,status,qualification_event,created_at,qualified_at&order=created_at.desc&limit=100`
    const response = await fetch(`${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1/${query}`, {
      headers: { apikey: env.supabaseServiceRoleKey!, Authorization: `Bearer ${env.supabaseServiceRoleKey!}` }, cache: "no-store",
    })
    if (!response.ok) return NextResponse.json({ ok: false, error: "REFERRAL_HISTORY_UNAVAILABLE" }, { status: 503 })
    const referrals = await response.json() as Array<Record<string, unknown>>
    const counts = { pending: 0, qualified: 0, paid: 0, rejected: 0, appealed: 0 }
    for (const row of referrals) {
      const status = String(row.status || "pending") as keyof typeof counts
      if (status in counts) counts[status] += 1
    }
    return NextResponse.json({ ok: true, code: codeResult.code, referrals, counts }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, error: "REFERRAL_HISTORY_UNAVAILABLE" }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`growth-referral-register:${auth.userId}`, 5, 60 * 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const body = await request.json().catch(() => ({})) as { referralCode?: string }
  const code = String(body.referralCode || "").trim().toUpperCase()
  if (!/^[A-F0-9]{10}$/.test(code)) return NextResponse.json({ ok: false, error: "INVALID_REFERRAL_CODE" }, { status: 400 })
  const result = await requestRpc("gh_growth_referral_register", { p_referred_user_id: auth.userId, p_referral_code: code })
  if (!result) return NextResponse.json({ ok: false, error: "REFERRAL_DATABASE_UNAVAILABLE" }, { status: 503 })
  if (result.ok !== true) {
    const error = String(result.error || "REFERRAL_REGISTER_FAILED")
    return NextResponse.json({ ok: false, error }, { status: error === "REFERRAL_CODE_NOT_FOUND" ? 404 : 409 })
  }
  return NextResponse.json({ ok: true, referralId: result.referralId, status: result.status }, { status: 201 })
}
