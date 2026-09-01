/**
 * POST /api/marketplace/orders — create order (payment_pending)
 * GET  /api/marketplace/orders — list for authenticated user
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  genOrderId,
  saveOrder,
  listOrdersForUser,
  type ServerMarketOrder,
} from "@/lib/server/marketplace/order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const listingId = String(body.listingId || "").trim()
  const sellerId = String(body.sellerId || "").trim()
  const listingTitle = String(body.listingTitle || "Listing").slice(0, 200)
  const quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1))
  const unitPrice = Number(body.unitPrice)
  const currency = String(body.currency || "GHC").toUpperCase()

  if (!listingId || !sellerId) {
    return NextResponse.json({ ok: false, error: "listingId and sellerId required" }, { status: 400 })
  }
  if (sellerId === auth.userId) {
    return NextResponse.json({ ok: false, error: "CANNOT_BUY_OWN" }, { status: 400 })
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > 1_000_000) {
    return NextResponse.json({ ok: false, error: "INVALID_PRICE" }, { status: 400 })
  }

  const order: ServerMarketOrder = {
    id: genOrderId(),
    listingId,
    listingTitle,
    buyerId: auth.userId,
    sellerId,
    quantity,
    unitPrice,
    currency,
    totalAmount: unitPrice * quantity,
    status: "payment_pending",
    paymentMethod: "none",
    paymentStatus: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    audit: [{ at: Date.now(), action: "CREATED", detail: auth.userId }],
  }
  saveOrder(order)

  return NextResponse.json({ ok: true, order })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  return NextResponse.json({ ok: true, orders: listOrdersForUser(auth.userId) })
}
