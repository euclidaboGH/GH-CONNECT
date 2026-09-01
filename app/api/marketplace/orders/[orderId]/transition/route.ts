/**
 * POST /api/marketplace/orders/[orderId]/transition
 * Body: { to: "fulfilling" | "completed" | "cancelled" | "disputed" }
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getOrder, transitionOrder } from "@/lib/server/marketplace/order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  const order = getOrder(orderId)
  if (!order) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (order.buyerId !== auth.userId && order.sellerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const to = String(body.to || "").toLowerCase()

  if (to === "fulfilling" && order.sellerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "SELLER_ONLY" }, { status: 403 })
  }
  if (to === "completed" && order.buyerId !== auth.userId && order.sellerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  // Buyer or seller can cancel before fulfill
  if (to === "cancelled" && order.status === "completed") {
    return NextResponse.json({ ok: false, error: "ALREADY_COMPLETED" }, { status: 409 })
  }

  const result = transitionOrder(orderId, to as Parameters<typeof transitionOrder>[1], auth.userId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  // Seller payout entitlement marker on complete (A2U wired later)
  if (to === "completed") {
    result.order.audit.push({
      at: Date.now(),
      action: "SELLER_PAYOUT_PENDING",
      detail: "A2U payout entitlement recorded — settle via GH Pay A2U when enabled",
    })
  }

  return NextResponse.json({ ok: true, order: result.order })
}
