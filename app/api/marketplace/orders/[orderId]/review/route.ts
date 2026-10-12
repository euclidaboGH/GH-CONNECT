import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`market-review:${auth.userId}`, 10, 60 * 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const { orderId } = await ctx.params
  if (!orderId || orderId.length > 128) return NextResponse.json({ ok: false, error: "INVALID_ORDER_ID" }, { status: 400 })
  const body = await request.json().catch(() => ({})) as { rating?: number; text?: string }
  const rating = Number(body.rating)
  const text = String(body.text || "").trim()
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 3 || text.length > 2000) {
    return NextResponse.json({ ok: false, error: "INVALID_REVIEW" }, { status: 400 })
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_marketplace_review_create`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_order_id: orderId, p_reviewer_id: auth.userId, p_rating: rating, p_review_text: text }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result) return NextResponse.json({ ok: false, error: "REVIEW_SERVICE_UNAVAILABLE" }, { status: 503 })
    if (result.ok !== true) {
      const error = String(result.error || "REVIEW_FAILED")
      const status = error === "ORDER_NOT_FOUND" ? 404 : error === "BUYER_ONLY" || error === "SELF_REVIEW" ? 403 : 409
      return NextResponse.json({ ok: false, error }, { status })
    }
    return NextResponse.json({ ok: true, reviewId: result.reviewId, status: result.status, publicationDelayDays: Number(result.publicationDelayDays) || 7 }, { status: 201 })
  } catch { return NextResponse.json({ ok: false, error: "REVIEW_SERVICE_UNAVAILABLE" }, { status: 503 }) }
}
