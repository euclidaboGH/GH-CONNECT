/**
 * GET /api/marketplace/orders/[orderId]
 * Buyer or seller only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadOrder } from "@/lib/server/marketplace/order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const auth = await resolveAuthenticatedUser(_request.headers)
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }
  const { orderId } = await ctx.params
  const order = await loadOrder(orderId)
  if (!order) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    )
  }
  if (order.buyerId !== auth.userId && order.sellerId !== auth.userId) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  return NextResponse.json(
    { ok: true, order },
    { headers: { "Cache-Control": "no-store" } }
  )
}
