/**
 * POST /api/payments/orders — register a GH Pay order before Pi payment.
 * GET  /api/payments/orders — list orders for authenticated user.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getProduct } from "@/lib/gh-pay/catalog"
import { genOrderId, saveOrder, listOrdersForUser, getOrder } from "@/lib/gh-pay/order-store"
import type { GhPayOrder } from "@/lib/gh-pay/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  const body = await request.json().catch(() => ({}))
  const productId = String(body.productId || "").trim()
  const product = getProduct(productId)
  if (!product || product.direction !== "u2a") {
    return NextResponse.json({ ok: false, error: "Invalid product" }, { status: 400 })
  }

  const orderId = String(body.orderId || genOrderId()).trim()
  const amountPi =
    body.amountPi != null ? Number(body.amountPi) : product.amountPi
  if (!Number.isFinite(amountPi) || amountPi <= 0 || amountPi > 10_000) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
  }

  const existing = getOrder(orderId)
  if (existing) {
    return NextResponse.json({ ok: true, order: existing, idempotent: true })
  }

  const order: GhPayOrder = {
    orderId,
    direction: "u2a",
    productId: product.id,
    category: product.category,
    amountPi,
    memo: String(body.memo || product.memo),
    userId: auth?.userId || String(body.userId || "anonymous"),
    status: "created",
    fulfillment: body.fulfillment || product.fulfillment,
    metadata: body.metadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  saveOrder(order)
  return NextResponse.json({ ok: true, order })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const orders = listOrdersForUser(auth.userId)
  return NextResponse.json({ ok: true, orders })
}
