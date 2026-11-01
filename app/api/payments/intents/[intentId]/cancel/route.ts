import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  loadPaymentIntent,
  transitionIntent,
} from "@/lib/server/payments/intent-store"

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
  // Durable-only: never fall back to process memory when storage is unavailable
  const intent = (await loadPaymentIntent(intentId))
  if (!intent) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (intent.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (["COMPLETED", "FULFILLED", "FAILED", "REFUNDED"].includes(intent.status)) {
    return NextResponse.json(
      { ok: false, error: "PAYMENT_INTENT_TERMINAL", status: intent.status },
      { status: 409 }
    )
  }
  if (intent.status === "CANCELLED") {
    return NextResponse.json({ ok: true, intent, idempotent: true })
  }
  const updated = await transitionIntent(intentId, "CANCELLED", {
    actor: auth.userId,
    detail: "User cancelled",
  })
  if (!updated) {
    return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, { status: 503 })
  }
  return NextResponse.json({ ok: true, intent: updated })
}
