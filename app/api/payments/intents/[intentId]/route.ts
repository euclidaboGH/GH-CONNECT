/**
 * GET /api/payments/intents/[intentId]
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getPaymentIntent } from "@/lib/server/payments/intent-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  ctx: { params: Promise<{ intentId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { intentId } = await ctx.params
  const intent = getPaymentIntent(intentId)
  if (!intent) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (intent.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  return NextResponse.json({ ok: true, intent })
}
