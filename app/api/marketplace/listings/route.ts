/**
 * POST /api/marketplace/listings — seller registers/updates authoritative listing (price, stock).
 * Body: { id?, title, description?, price, currency?, availability?, status?, kind? }
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { upsertListing, listingsDurable } from "@/lib/server/marketplace/listing-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!listingsDurable()) {
    return NextResponse.json(
      { ok: false, error: "LISTINGS_REQUIRE_DATABASE", message: "Apply marketplace listings migration" },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const title = String(body.title || "").trim().slice(0, 200)
  const price = Number(body.price)
  const currency = String(body.currency || "GHC").toUpperCase().slice(0, 8)
  const availability = Math.max(0, Math.min(9999, Number(body.availability) || 1))
  const status = String(body.status || "active")
  const kind = String(body.kind || "product")
  const id =
    String(body.id || "").trim() ||
    `lst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  if (!title) {
    return NextResponse.json({ ok: false, error: "TITLE_REQUIRED" }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    return NextResponse.json({ ok: false, error: "INVALID_PRICE" }, { status: 400 })
  }
  if (!["draft", "active", "paused", "sold_out", "removed"].includes(status)) {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 })
  }

  const saved = await upsertListing({
    id,
    sellerId: auth.userId,
    title,
    description: String(body.description || "").slice(0, 4000),
    price,
    currency,
    availability,
    status: status as "draft" | "active" | "paused" | "sold_out" | "removed",
    kind,
  })
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    listing: { id, sellerId: auth.userId, title, price, currency, availability, status, kind },
  })
}
