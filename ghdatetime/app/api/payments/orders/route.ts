/**
 * POST /api/payments/orders — register a GH Pay order before Pi payment.
 * GET  /api/payments/orders — list orders for authenticated user.
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getProduct } from "@/lib/gh-pay/catalog"
import { genOrderId, saveOrder, listOrdersForUser, getOrder } from "@/lib/gh-pay/order-store"
import type { GhPayOrder } from "@/lib/gh-pay/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const parsedBody = await readBoundedJson(request, 8 * 1024)
    if (!parsedBody.ok) {
      const tooLarge = parsedBody.error === "REQUEST_TOO_LARGE"
      return NextResponse.json(
        { ok: false, error: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST_BODY" },
        { status: tooLarge ? 413 : 400, headers: { "Cache-Control": "no-store" } },
      )
    }
    const body = parsedBody.value
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  const product = getProduct(productId)
  if (!product || product.direction !== "u2a") {
    return NextResponse.json({ ok: false, error: "Invalid product" }, { status: 400 })
  }

  const orderId = typeof body.orderId === "string" && body.orderId.trim()
    ? body.orderId.trim()
    : genOrderId()
  if (orderId.length > 160) {
    return NextResponse.json({ ok: false, error: "Invalid order ID" }, { status: 400 })
  }

  // Server catalog is authoritative for non-donation products. Client amountPi
  // is ignored except for donations (bounded). Never trust body.userId.
  let amountPi = product.amountPi
  if (product.category === "donation" && body.amountPi != null) {
    const rawAmount = body.amountPi
    const validAmountType = typeof rawAmount === "number"
      ? Number.isFinite(rawAmount)
      : typeof rawAmount === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(rawAmount.trim())
    const proposed = validAmountType ? Number(rawAmount) : Number.NaN
    if (!Number.isFinite(proposed) || proposed <= 0 || proposed > 10_000) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
    }
    amountPi = Math.min(Math.max(proposed, 0.01), 100)
  }
  if (!Number.isFinite(amountPi) || amountPi <= 0 || amountPi > 10_000) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
  }

  const existing = getOrder(orderId)
  if (existing) {
    // Ownership: do not return another user's order under the same id.
    if (existing.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }
    return NextResponse.json({ ok: true, order: existing, idempotent: true })
  }

  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : undefined
  if (body.metadata !== undefined && metadata === undefined) {
    return NextResponse.json({ ok: false, error: "Invalid metadata" }, { status: 400 })
  }
  const memo = typeof body.memo === "string" ? body.memo.trim() : product.memo
  if (memo.length > 500) {
    return NextResponse.json({ ok: false, error: "Invalid memo" }, { status: 400 })
  }

  const order: GhPayOrder = {
    orderId,
    direction: "u2a",
    productId: product.id,
    category: product.category,
    amountPi,
    memo: memo || product.memo,
    userId: auth.userId,
    status: "created",
    // Fulfillment comes from catalog only — client cannot redefine entitlement shape.
    fulfillment: product.fulfillment,
    metadata,
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
