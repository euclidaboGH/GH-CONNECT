import { NextResponse } from "next/server"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request, ctx: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await ctx.params
  if (!sellerId || sellerId.length > 256) return NextResponse.json({ ok: false, error: "INVALID_SELLER_ID" }, { status: 400 })
  const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get("limit") || 20)))
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const query = `gh_marketplace_reviews?seller_id=eq.${encodeURIComponent(sellerId)}&status=eq.published&select=id,rating,review_text,published_at&order=published_at.desc&limit=${limit}`
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${query}`, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" })
    if (!response.ok) return NextResponse.json({ ok: false, error: "REVIEWS_UNAVAILABLE" }, { status: 503 })
    const reviews = await response.json() as Array<Record<string, unknown>>
    const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : null
    return NextResponse.json({ ok: true, reviews, returnedCount: reviews.length, averageRating, note: "Average is calculated over the returned recent page; use full seller analytics for complete totals." }, { headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "REVIEWS_UNAVAILABLE" }, { status: 503 }) }
}
