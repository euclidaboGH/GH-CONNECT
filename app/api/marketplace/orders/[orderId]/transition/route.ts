/**
 * POST /api/marketplace/orders/[orderId]/transition
 * Body: { to: "fulfilling" | "completed" | "cancelled" | "disputed" }
 *
 * payment_verified is NOT a public transition — only the pay route sets it
 * after authoritative GHC/Pi settlement.
 *
 * Paid lifecycle states (confirmed / fulfilling / completed / disputed / refunded)
 * require order.paymentStatus === "verified" from persisted order state.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadOrder, transitionOrder } from "@/lib/server/marketplace/order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** States that imply the order progressed past unpaid checkout */
const REQUIRES_VERIFIED_PAYMENT = new Set([
  "payment_verified",
  "confirmed",
  "fulfilling",
  "completed",
  "disputed",
  "refunded",
])

export async function POST(
  request: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  const order = await loadOrder(orderId)
  if (!order) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (order.buyerId !== auth.userId && order.sellerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  // Ignore client payment/identity spoofing — session + durable order only
  void body.paymentStatus
  void body.paid
  void body.verified
  void body.paymentVerified
  void body.amount
  void body.buyerId
  void body.sellerId
  void body.userId

  const to = String(body.to || "").toLowerCase()

  // payment_verified is established only by POST .../pay after settlement
  if (to === "payment_verified") {
    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENT_TRANSITION_FORBIDDEN",
        message:
          "payment_verified is set only by the authoritative pay route after settlement.",
      },
      { status: 403 }
    )
  }

  const paymentVerified = order.paymentStatus === "verified"

  if (REQUIRES_VERIFIED_PAYMENT.has(to) && !paymentVerified) {
    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENT_REQUIRED",
        message: "Order must have verified payment before this transition.",
        paymentStatus: order.paymentStatus || "none",
        status: order.status,
      },
      { status: 402 }
    )
  }

  // Paid cancel without refund product: reject to avoid unreconciled GHC debit
  if (to === "cancelled" && paymentVerified) {
    return NextResponse.json(
      {
        ok: false,
        error: "PAID_ORDER_CANCEL_REQUIRES_REFUND",
        message:
          "Paid orders cannot be cancelled through this API; no authoritative refund path is implemented.",
      },
      { status: 409 }
    )
  }

  if (to === "fulfilling" && order.sellerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "SELLER_ONLY" }, { status: 403 })
  }
  if (to === "completed" && order.buyerId !== auth.userId && order.sellerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (to === "cancelled" && order.status === "completed") {
    return NextResponse.json({ ok: false, error: "ALREADY_COMPLETED" }, { status: 409 })
  }

  const result = await transitionOrder(
    orderId,
    to as Parameters<typeof transitionOrder>[1],
    auth.userId
  )
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, order: result.order })
}
