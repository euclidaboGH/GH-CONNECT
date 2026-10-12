import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { listOrdersForUserDurable } from "@/lib/server/marketplace/order-store"
import { listSellerListings } from "@/lib/server/marketplace/listing-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const [orders, listings] = await Promise.all([
    listOrdersForUserDurable(auth.userId),
    listSellerListings(auth.userId, 100),
  ])
  const sellerOrders = orders.filter((order) => order.sellerId === auth.userId)
  const completed = sellerOrders.filter((order) => order.status === "completed")
  const disputed = sellerOrders.filter((order) => order.status === "disputed")
  const refunded = sellerOrders.filter((order) => order.status === "refunded")
  const grossByCurrency: Record<string, number> = {}
  const refundedByCurrency: Record<string, number> = {}
  for (const order of completed) grossByCurrency[order.currency] = (grossByCurrency[order.currency] || 0) + order.totalAmount
  for (const order of refunded) refundedByCurrency[order.currency] = (refundedByCurrency[order.currency] || 0) + order.totalAmount
  return NextResponse.json({
    ok: true,
    authoritative: true,
    window: "up-to-last-200-orders",
    orders: { total: sellerOrders.length, completed: completed.length, disputed: disputed.length, refunded: refunded.length },
    grossCompletedByCurrency: grossByCurrency,
    refundedByCurrency: refundedByCurrency,
    completedUnits: completed.reduce((sum, order) => sum + order.quantity, 0),
    disputeRate: sellerOrders.length ? disputed.length / sellerOrders.length : 0,
    listings: {
      total: listings.length,
      active: listings.filter((listing) => listing.status === "active").length,
      soldOut: listings.filter((listing) => listing.status === "sold_out").length,
      paused: listings.filter((listing) => listing.status === "paused").length,
      availableUnits: listings.reduce((sum, listing) => sum + listing.availability, 0),
    },
    unavailableMetrics: ["impressions", "conversion_rate", "net_proceeds_after_provider_fees"],
  }, { headers: { "Cache-Control": "no-store" } })
}
