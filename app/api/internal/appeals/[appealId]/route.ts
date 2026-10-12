import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, ctx: { params: Promise<{ appealId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const allowedReviewers = new Set((process.env.GHC_TRUST_REVIEWER_USER_IDS || "").split(",").map((v) => v.trim()).filter(Boolean))
  if (!allowedReviewers.has(auth.userId)) return NextResponse.json({ ok: false, error: "REVIEWER_FORBIDDEN" }, { status: 403 })
  const rl = checkRateLimit(`appeal-review:${auth.userId}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  const { appealId } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(appealId)) return NextResponse.json({ ok: false, error: "INVALID_APPEAL_ID" }, { status: 400 })
  const body = await request.json().catch(() => ({})) as { kind?: string; status?: string; resolutionNote?: string }
  const kind = body.kind === "reward" ? "reward" : body.kind === "reputation" ? "reputation" : ""
  if (!kind) return NextResponse.json({ ok: false, error: "INVALID_APPEAL_KIND" }, { status: 400 })
  // Reversal statuses are permitted only through the source-linked SQL compensation RPC.
  const status = String(body.status || "")
  const allowedStatuses = kind === "reward"
    ? new Set(["under_review", "upheld", "withdrawn", "reversed"])
    : new Set(["under_review", "upheld", "withdrawn", "reversed"])
  const note = String(body.resolutionNote || "").trim().slice(0, 2000)
  if (!allowedStatuses.has(status) || note.length < 10) return NextResponse.json({ ok: false, error: "INVALID_RESOLUTION" }, { status: 400 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    if (kind === "reward") {
      const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_reward_appeal_resolve`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
        body: JSON.stringify({ p_appeal_id: appealId, p_reviewer_id: auth.userId, p_status: status, p_note: note }), cache: "no-store",
      })
      const result = await response.json().catch(() => null) as Record<string, unknown> | null
      if (!response.ok || !result) return NextResponse.json({ ok: false, error: "APPEAL_UPDATE_FAILED" }, { status: 503 })
      if (result.ok !== true) return NextResponse.json({ ok: false, error: String(result.error || "APPEAL_UPDATE_FAILED"), message: result.message }, { status: 409 })
      return NextResponse.json({ ok: true, status: result.status, reversalTransactionId: result.reversalTransactionId, balanceChanged: Boolean(result.balanceChanged), duplicate: Boolean(result.duplicate) })
    }
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_reputation_appeal_resolve`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_appeal_id: appealId, p_reviewer_id: auth.userId, p_status: status, p_note: note }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result) return NextResponse.json({ ok: false, error: "APPEAL_UPDATE_FAILED" }, { status: 503 })
    if (result.ok !== true) return NextResponse.json({ ok: false, error: String(result.error || "APPEAL_UPDATE_FAILED"), message: result.message }, { status: 409 })
    return NextResponse.json({ ok: true, status: result.status, compensatedEventId: result.compensatedEventId, scoreChanged: Boolean(result.scoreChanged), duplicate: Boolean(result.duplicate) })

  } catch { return NextResponse.json({ ok: false, error: "APPEAL_UPDATE_FAILED" }, { status: 503 }) }
}
