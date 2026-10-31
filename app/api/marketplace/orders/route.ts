/**
 * POST /api/marketplace/orders — create order (payment_pending)
 * Client may only send: listingId, quantity
 * Server derives seller, price, currency, title from authoritative listing.
 *
 * GET  /api/marketplace/orders — durable list for authenticated user
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  genOrderId,
  createReservedOrder,
  listOrdersForUserDurable,
  type ServerMarketOrder,
} from "@/lib/server/marketplace/order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const parsed = await readBoundedJson(request, 16 * 1024)
  if (!parsed.ok) {
    const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
    return NextResponse.json({ ok: false, error: parsed.error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  const body = parsed.value
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : ""
  const rawQuantity = body.quantity
  const quantity = rawQuantity === undefined ? 1 : typeof rawQuantity === "number" ? rawQuantity : Number.NaN
  const idempotencyKey = String(request.headers.get("Idempotency-Key") || body.idempotencyKey || "").trim()

  // Ignore client price/seller/title/currency — never trust for financial totals
  void body.unitPrice
  void body.sellerId
  void body.listingTitle
  void body.currency
  void body.totalAmount
  void body.price

  if (!listingId || listingId.length > 160 || /[\u0000-\u001f\u007f]/.test(listingId)) {
    return NextResponse.json({ ok: false, error: "listingId required" }, { status: 400 })
  }
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    return NextResponse.json({ ok: false, error: "INVALID_QUANTITY" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
    return NextResponse.json(
      { ok: false, error: "IDEMPOTENCY_KEY_REQUIRED", message: "Provide a stable 8–128 character Idempotency-Key for order creation." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }

  // Listing price, seller, currency, status and availability are resolved under a
  // database row lock by gh_marketplace_order_create_reserved. Do not reject a replay
  // from a stale pre-read: the RPC owns both idempotency and inventory authority.
  const order: ServerMarketOrder = {
    id: genOrderId(),
    listingId,
    listingTitle: "",
    buyerId: auth.userId,
    sellerId: "",
    quantity,
    unitPrice: 0,
    currency: "GHC",
    totalAmount: 0,
    status: "payment_pending",
    paymentMethod: "none",
    paymentStatus: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    audit: [{ at: Date.now(), action: "CREATED", detail: auth.userId }],
  }

  const created = await createReservedOrder(order, idempotencyKey)
  if (!created.ok) {
    const status = created.error === "LISTING_NOT_FOUND" ? 404 :
      created.error === "INSUFFICIENT_STOCK" ? 409 :
      created.error === "CANNOT_BUY_OWN" ? 400 :
      created.error === "INVALID_INPUT" || created.error === "UNSUPPORTED_CURRENCY" ? 400 :
      created.error === "IDEMPOTENCY_CONFLICT" ? 409 :
      created.error === "LISTING_UNAVAILABLE" ? 409 : 503
    return NextResponse.json(
      { ok: false, error: created.error, available: created.available },
      { status, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json(
    { ok: true, order: created.order, idempotent: created.idempotent },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const orders = await listOrdersForUserDurable(auth.userId)
  return NextResponse.json({ ok: true, orders }, { headers: { "Cache-Control": "no-store" } })
}
