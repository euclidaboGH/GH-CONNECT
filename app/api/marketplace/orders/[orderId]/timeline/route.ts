import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { listOrderTimeline } from "@/lib/server/marketplace/order-store"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const { orderId } = await ctx.params
  if (!orderId || orderId.length > 160) return NextResponse.json({ ok: false, error: "INVALID_ORDER_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const result = await listOrderTimeline(orderId, auth.userId)
  if (!result.ok) {
    const status = result.error === "FORBIDDEN" ? 403 : result.error === "NOT_FOUND" ? 404 : 503
    return NextResponse.json({ ok: false, error: result.error }, { status, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, events: result.events }, { headers: { "Cache-Control": "no-store" } })
}
