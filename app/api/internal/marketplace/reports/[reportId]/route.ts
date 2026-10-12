import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const reviewers = new Set((process.env.GHC_MARKETPLACE_REVIEWER_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean))
  if (!reviewers.has(auth.userId)) return NextResponse.json({ ok: false, error: "REVIEWER_FORBIDDEN" }, { status: 403 })
  const rl = checkRateLimit(`marketplace-report-review:${auth.userId}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  const { reportId } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return NextResponse.json({ ok: false, error: "INVALID_REPORT_ID" }, { status: 400 })
  const body = await request.json().catch(() => ({})) as { status?: string; note?: string }
  const status = String(body.status || "")
  const note = String(body.note || "").trim().slice(0, 2000)
  if (!new Set(["under_review", "upheld", "dismissed"]).has(status) || note.length < 10) return NextResponse.json({ ok: false, error: "INVALID_RESOLUTION" }, { status: 400 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_marketplace_listing_report_resolve`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_report_id: reportId, p_reviewer_id: auth.userId, p_status: status, p_note: note }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result) return NextResponse.json({ ok: false, error: "REPORT_REVIEW_UNAVAILABLE" }, { status: 503 })
    if (result.ok !== true) return NextResponse.json({ ok: false, error: String(result.error || "REPORT_REVIEW_FAILED") }, { status: 409 })
    return NextResponse.json({ ok: true, status: result.status, listingId: result.listingId, duplicate: Boolean(result.duplicate) })
  } catch { return NextResponse.json({ ok: false, error: "REPORT_REVIEW_UNAVAILABLE" }, { status: 503 }) }
}
