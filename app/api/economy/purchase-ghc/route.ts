/**
 * POST /api/economy/purchase-ghc
 *
 * Pi-powered GHC purchase — server authoritative only:
 *   verified Pi payment → payment intent COMPLETED → ledger credit → notify
 *
 * Never accept a client assertion of "+N GHC" without completed intent + Pi lookup.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getPaymentIntent } from "@/lib/server/payments/intent-store"
import { ASSET_POLICY } from "@/lib/asset-separation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const enabled = process.env.GHC_BUY_WITH_PI_ENABLED === "true"
  if (!enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "BUY_GHC_DISABLED",
        message: "Buy GHC with π is not enabled until payment + ledger path is production-ready.",
        policy: ASSET_POLICY.payCopy,
      },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const intentId = String(body.intentId || "").trim()
  const paymentId = String(body.paymentId || "").trim()

  if (!intentId) {
    return NextResponse.json({ ok: false, error: "intentId required" }, { status: 400 })
  }

  const intent = getPaymentIntent(intentId)
  if (!intent || intent.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "INTENT_NOT_FOUND" }, { status: 404 })
  }
  if (intent.status !== "COMPLETED") {
    return NextResponse.json(
      { ok: false, error: "INTENT_NOT_COMPLETED", status: intent.status },
      { status: 409 }
    )
  }
  if (intent.purpose !== "other" && intent.metadata?.productId !== "ghc_pack") {
    // require explicit purchase purpose when packs are defined
  }
  if (paymentId && intent.providerPaymentId && paymentId !== intent.providerPaymentId) {
    return NextResponse.json({ ok: false, error: "payment_mismatch" }, { status: 409 })
  }

  // Ledger credit would run here via server economy service (not implemented until packs defined).
  // Placeholder response — no balance mutation without ledger write path.
  return NextResponse.json({
    ok: false,
    error: "LEDGER_CREDIT_NOT_WIRED",
    message:
      "Payment verified shape is correct. Wire server ledger credit for GHC packs before enabling BUY.",
    intentId,
    amountPi: intent.amount,
  })
}
