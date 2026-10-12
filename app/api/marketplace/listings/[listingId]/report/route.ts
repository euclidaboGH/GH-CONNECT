import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getListing } from "@/lib/server/marketplace/listing-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { enqueueDomainEvent } from "@/lib/server/domain-events/outbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, ctx: { params: Promise<{ listingId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`market-listing-report:${auth.userId}`, 5, 60 * 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const { listingId } = await ctx.params
  const listing = await getListing(listingId)
  if (!listing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  if (listing.sellerId === auth.userId) return NextResponse.json({ ok: false, error: "CANNOT_REPORT_OWN_LISTING" }, { status: 400 })
  const body = await request.json().catch(() => ({})) as { reasonCode?: string; details?: string }
  const reasons = new Set(["prohibited_item", "counterfeit", "scam", "misleading_listing", "unsafe_service", "wrong_category", "other"])
  const reasonCode = String(body.reasonCode || "other")
  const details = String(body.details || "").trim()
  if (!reasons.has(reasonCode) || details.length < 10 || details.length > 2000) return NextResponse.json({ ok: false, error: "INVALID_REPORT" }, { status: 400 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_marketplace_listing_reports`, {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ listing_id: listing.id, reporter_id: auth.userId, seller_id: listing.sellerId, reason_code: reasonCode, details }),
    })
    const rows = await response.json().catch(() => null) as Array<Record<string, unknown>> | null
    if (!response.ok || !Array.isArray(rows) || !rows[0]) return NextResponse.json({ ok: false, error: response.status === 409 ? "REPORT_ALREADY_EXISTS" : "REPORT_CREATE_FAILED" }, { status: response.status === 409 ? 409 : 503 })
    await enqueueDomainEvent({ eventType: "marketplace.listing_reported", idempotencyKey: `marketplace.listing-report:${rows[0].id}`, aggregateType: "marketplace_listing", aggregateId: listing.id, actorId: auth.userId, payload: { reportId: rows[0].id, listingId: listing.id, reasonCode } })
    return NextResponse.json({ ok: true, reportId: rows[0].id, status: "open" }, { status: 201 })
  } catch { return NextResponse.json({ ok: false, error: "REPORT_CREATE_FAILED" }, { status: 503 }) }
}
