import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadOrder, updateCommerceOrder, updateOrderFulfilment, type MarketplaceFulfilmentAction } from "@/lib/server/marketplace/order-store"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { parseMarketplaceFulfilmentInput } from "@/lib/marketplace/fulfilment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const FULFILMENT_ACTIONS = new Set(["seller_fulfill", "seller_dispatch", "seller_mark_delivered", "buyer_confirm"])

type CommerceResult = Awaited<ReturnType<typeof updateCommerceOrder>> | Awaited<ReturnType<typeof updateOrderFulfilment>>

export async function POST(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const { orderId } = await ctx.params
  if (!orderId || orderId.length > 160) return NextResponse.json({ ok: false, error: "INVALID_ORDER_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const order = await loadOrder(orderId)
  if (!order) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  if (order.buyerId !== auth.userId && order.sellerId !== auth.userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) {
    const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
    return NextResponse.json({ ok: false, error: parsed.error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  const input = parseMarketplaceFulfilmentInput(parsed.value)
  if (!input.ok) return NextResponse.json({ ok: false, error: input.error }, { status: 400, headers: { "Cache-Control": "no-store" } })

  let result: CommerceResult
  if (FULFILMENT_ACTIONS.has(input.value.action)) {
    result = await updateOrderFulfilment(orderId, auth.userId, input.value.action as MarketplaceFulfilmentAction, {
      method: input.value.method, carrier: input.value.carrier, trackingNumber: input.value.trackingNumber,
      trackingUrl: input.value.trackingUrl, estimatedDeliveryAt: input.value.estimatedDeliveryAt, note: input.value.note,
    })
  } else {
    result = await updateCommerceOrder(orderId, auth.userId, input.value.action as "dispute" | "cancel_unpaid", input.value.note)
  }
  if (!result.ok) {
    const status = ["FORBIDDEN", "SELLER_ONLY", "BUYER_ONLY"].includes(result.error) ? 403
      : ["PAYMENT_REQUIRED", "INVALID_STATE", "PAID_OR_STARTED", "DISPATCH_REQUIRED", "DELIVERY_NOT_CONFIRMED", "SHIPPING_DETAILS_REQUIRED"].includes(result.error) ? 409 : 400
    return NextResponse.json({ ok: false, error: result.error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, order: result.order }, { headers: { "Cache-Control": "no-store" } })
}
