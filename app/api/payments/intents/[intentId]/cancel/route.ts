import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getPaymentIntent, transitionIntent } from "@/lib/server/payments/intent-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
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
  if (intent.status === "COMPLETED" || intent.status === "REFUNDED") {
    return NextResponse.json(
      { ok: false, error: "Cannot cancel completed payment" },
      { status: 400 }
    )
  }
  if (intent.status === "CANCELLED") {
    return NextResponse.json({ ok: true, intent, idempotent: true })
  }
  const result = transitionIntent(intentId, "CANCELLED", {
    actor: auth.userId,
    detail: "User cancelled",
  })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true, intent: result.intent })
}
