/** GET /api/payments/intents/[intentId]/timeline
 * User-scoped, read-only view of persisted payment-intent audit events.
 * Never fabricates provider events or derives historical timestamps from current state.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadPaymentIntent } from "@/lib/server/payments/intent-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" }

export async function GET(request: Request, ctx: { params: Promise<{ intentId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })

  const { intentId } = await ctx.params
  if (!intentId || intentId.length > 200) {
    return NextResponse.json({ ok: false, error: "INVALID_INTENT_ID" }, { status: 400, headers: noStore })
  }

  try {
    const intent = await loadPaymentIntent(intentId)
    if (!intent) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: noStore })
    if (intent.userId !== auth.userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: noStore })

    const events = (Array.isArray(intent.audit) ? intent.audit : [])
      .filter((event) => Number.isFinite(event?.at) && event.at > 0 && typeof event.action === "string")
      .map((event, index) => ({
        id: `${intent.id}:${event.at}:${index}`,
        at: event.at,
        action: event.action.slice(0, 100),
        actor: typeof event.actor === "string" ? event.actor.slice(0, 80) : null,
        detail: typeof event.detail === "string" ? event.detail.slice(0, 300) : null,
      }))
      .sort((a, b) => a.at - b.at)

    return NextResponse.json({
      ok: true,
      readOnly: true,
      source: "persisted_payment_intent_audit",
      intentId: intent.id,
      currentStatus: intent.status,
      eventCount: events.length,
      events,
      historyAvailable: events.length > 0,
      note: events.length > 0
        ? "Only persisted intent audit events are shown. This is not a complete Pi blockchain or provider event history."
        : "No persisted audit events are available for this intent. No events or timestamps were synthesized.",
    }, { headers: noStore })
  } catch {
    return NextResponse.json({ ok: false, error: "PAYMENT_TIMELINE_UNAVAILABLE" }, { status: 503, headers: noStore })
  }
}
