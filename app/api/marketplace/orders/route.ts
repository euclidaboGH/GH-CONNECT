/**
 * POST /api/marketplace/orders — create order (payment_pending)
 * Client may only send: listingId, quantity
 * Server derives seller, price, currency, title from authoritative listing.
 *
 * GET  /api/marketplace/orders — durable list for authenticated user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  genOrderId,
  saveOrder,
  loadOrder,
  claimOrderIdempotency,
  listOrdersForUserDurable,
  type ServerMarketOrder,
} from "@/lib/server/marketplace/order-store"
import { getListing, reserveListingStock, releaseListingStock } from "@/lib/server/marketplace/listing-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rateLimit = checkRateLimit(`market-order-create:${auth.userId}`, 10, 60_000)
  if (!rateLimit.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rateLimit.retryAfterSec }, { status: 429 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const listingId = String(body.listingId || "").trim()
  const requestedQuantity = body.quantity == null ? 1 : Number(body.quantity)
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 99) {
    return NextResponse.json({ ok: false, error: "INVALID_QUANTITY", min: 1, max: 99 }, { status: 400 })
  }
  const quantity = requestedQuantity

  // Ignore client price/seller/title/currency — never trust for financial totals
  void body.unitPrice
  void body.sellerId
  void body.listingTitle
  void body.currency
  void body.totalAmount
  void body.price

  if (!listingId || listingId.length > 128) {
    return NextResponse.json({ ok: false, error: "INVALID_LISTING_ID" }, { status: 400 })
  }

  let orderId = genOrderId()
  const suppliedIdempotencyKey = String(request.headers.get("Idempotency-Key") || body.idempotencyKey || "").trim()
  if (!suppliedIdempotencyKey) return NextResponse.json({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED", message: "Provide a stable Idempotency-Key for safe checkout retries." }, { status: 400 })
  if (suppliedIdempotencyKey.length < 8 || suppliedIdempotencyKey.length > 128 || /[\r\n]/.test(suppliedIdempotencyKey)) {
    return NextResponse.json({ ok: false, error: "INVALID_IDEMPOTENCY_KEY" }, { status: 400 })
  }
  const claim = await claimOrderIdempotency({
    buyerId: auth.userId,
    idempotencyKey: suppliedIdempotencyKey,
    requestFingerprint: `${listingId}:${quantity}`,
    proposedOrderId: orderId,
  })
  if (!claim.ok) return NextResponse.json({ ok: false, error: claim.error }, { status: 503 })
  orderId = claim.orderId
  if (claim.duplicate) {
    const existingOrder = await loadOrder(orderId)
    if (existingOrder) {
      if (existingOrder.buyerId !== auth.userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
      return NextResponse.json({ ok: true, order: existingOrder, idempotent: true }, { headers: { "Cache-Control": "no-store" } })
    }
  }

  if (process.env.GH_MARKETPLACE_PAUSED === "1") return NextResponse.json({ ok: false, error: "MARKETPLACE_PAUSED" }, { status: 503 })

  const listing = await getListing(listingId)
  if (!listing) {
    return NextResponse.json(
      { ok: false, error: "LISTING_NOT_FOUND", message: "Listing must be registered on the server first (POST /api/marketplace/listings)." },
      { status: 404 }
    )
  }
  if (listing.status !== "active") {
    return NextResponse.json({ ok: false, error: "LISTING_UNAVAILABLE", status: listing.status }, { status: 409 })
  }
  if (listing.sellerId === auth.userId) {
    return NextResponse.json({ ok: false, error: "CANNOT_BUY_OWN" }, { status: 400 })
  }
  // Always require a database-backed atomic reservation. A feature flag alone
  // cannot prove the RPC exists or prevent concurrent overselling.
  if (!Number.isFinite(listing.price) || listing.price <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_LISTING_PRICE", message: "Marketplace checkout currently requires a positive price." }, { status: 409 })
  }

  const reservation = await reserveListingStock({
    listingId: listing.id,
    orderId,
    buyerId: auth.userId,
    quantity,
    ttlSeconds: 3600,
  })
  if (!reservation.ok) {
    const status = reservation.error === "INSUFFICIENT_STOCK" || reservation.error === "LISTING_UNAVAILABLE" ? 409 : 503
    return NextResponse.json({
      ok: false,
      error: reservation.error,
      message: status === 503 ? "Atomic stock reservation is unavailable; no order was created." : undefined,
      available: reservation.available,
    }, { status })
  }

  const unitPrice = Number(listing.price)
  const precision = listing.currency === "GHC" ? 1e4 : 1e8
  const totalAmount = Math.round(unitPrice * quantity * precision) / precision

  const order: ServerMarketOrder = {
    id: orderId,
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
    await releaseListingStock(order.id)
    return NextResponse.json(
      { ok: false, error: "ORDER_PERSIST_FAILED", detail: saved.error },
      { status: 503 }
    )
  }

  return NextResponse.json({ ok: true, order }, { headers: { "Cache-Control": "no-store" } })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const orders = await listOrdersForUserDurable(auth.userId)
  return NextResponse.json({ ok: true, orders }, { headers: { "Cache-Control": "no-store" } })
}
