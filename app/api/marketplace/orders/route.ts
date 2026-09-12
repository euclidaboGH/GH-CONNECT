/**
 * POST /api/marketplace/orders — create order (payment_pending)
 * Client may only send: listingId, quantity
 * Server derives seller, price, currency, title from authoritative listing.
 *
 * GET  /api/marketplace/orders — durable list for authenticated user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  genOrderId,
  saveOrder,
  listOrdersForUserDurable,
  type ServerMarketOrder,
} from "@/lib/server/marketplace/order-store"
import { getListing } from "@/lib/server/marketplace/listing-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const listingId = String(body.listingId || "").trim()
  const quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)))

  // Ignore client price/seller/title/currency — never trust for financial totals
  void body.unitPrice
  void body.sellerId
  void body.listingTitle
  void body.currency
  void body.totalAmount
  void body.price

  if (!listingId) {
    return NextResponse.json({ ok: false, error: "listingId required" }, { status: 400 })
  }

  const listing = await getListing(listingId)
  if (!listing) {
    return NextResponse.json(
      {
        ok: false,
        error: "LISTING_NOT_FOUND",
        message:
          "Listing must be registered on the server first (POST /api/marketplace/listings).",
      },
      { status: 404 }
    )
  }
  if (listing.status !== "active") {
    return NextResponse.json(
      { ok: false, error: "LISTING_UNAVAILABLE", status: listing.status },
      { status: 409 }
    )
  }
  if (listing.sellerId === auth.userId) {
    return NextResponse.json({ ok: false, error: "CANNOT_BUY_OWN" }, { status: 400 })
  }
  if (listing.availability < quantity) {
    return NextResponse.json(
      { ok: false, error: "INSUFFICIENT_STOCK", available: listing.availability },
      { status: 409 }
    )
  }
  if (!Number.isFinite(listing.price) || listing.price < 0) {
    return NextResponse.json({ ok: false, error: "INVALID_LISTING_PRICE" }, { status: 500 })
  }

  const unitPrice = Number(listing.price)
  const totalAmount = Math.round(unitPrice * quantity * 1e8) / 1e8

  const order: ServerMarketOrder = {
    id: genOrderId(),
    listingId: listing.id,
    listingTitle: listing.title.slice(0, 200),
    buyerId: auth.userId,
    sellerId: listing.sellerId,
    quantity,
    unitPrice,
    currency: listing.currency || "GHC",
    totalAmount,
    status: "payment_pending",
    paymentMethod: "none",
    paymentStatus: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    audit: [{ at: Date.now(), action: "CREATED", detail: auth.userId }],
  }

  const saved = await saveOrder(order)
  if (!saved.ok) {
    return NextResponse.json(
      { ok: false, error: "ORDER_PERSIST_FAILED", detail: saved.error },
      { status: 503 }
    )
  }

  return NextResponse.json({ ok: true, order })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const orders = await listOrdersForUserDurable(auth.userId)
  return NextResponse.json({ ok: true, orders })
}
