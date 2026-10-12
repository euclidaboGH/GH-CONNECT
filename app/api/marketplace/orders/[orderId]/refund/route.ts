import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadOrder } from "@/lib/server/marketplace/order-store"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`market-refund:${auth.userId}`, 5, 60 * 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const { orderId } = await ctx.params
  const order = await loadOrder(orderId)
  if (!order) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  if (order.buyerId !== auth.userId && order.sellerId !== auth.userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  if (order.paymentMethod !== "ghc") return NextResponse.json({ ok: false, error: "PROVIDER_REFUND_UNAVAILABLE", message: "Provider-verified Pi refunds are not enabled; no refund status was changed." }, { status: 409 })
  if (order.status !== "disputed" && !(order.status === "refunded" && order.paymentStatus === "refunded")) {
    return NextResponse.json({ ok: false, error: "DISPUTE_REQUIRED", message: "Move the order to disputed before resolving a GHC refund." }, { status: 409 })
  }
  const body = await request.json().catch(() => ({})) as { reason?: string }
  const reason = String(body.reason || "Marketplace dispute resolution").trim().slice(0, 240)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_marketplace_refund_ghc`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_order_id: order.id, p_actor_id: auth.userId, p_reason: reason }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result) return NextResponse.json({ ok: false, error: "REFUND_SERVICE_UNAVAILABLE" }, { status: 503 })
    if (result.ok !== true) return NextResponse.json({ ok: false, error: String(result.error || "REFUND_FAILED") }, { status: 409 })
    return NextResponse.json({ ok: true, duplicate: Boolean(result.duplicate), orderId: result.orderId, reversalTransactionId: result.reversalTransactionId, amount: result.amount }, { headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "REFUND_SERVICE_UNAVAILABLE" }, { status: 503 }) }
}
