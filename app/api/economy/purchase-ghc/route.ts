/**
 * POST /api/economy/purchase-ghc
 *
 * Pi-powered GHC pack purchase — server authoritative only:
 *   verified Pi payment → payment intent COMPLETED → ledger credit
 *
 * Never accept a client assertion of "+N GHC" without completed intent + Pi lookup.
 * Never invent ledger credits when packs / credit path are not configured.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getPaymentIntent, loadPaymentIntent } from "@/lib/server/payments/intent-store"
import { ASSET_POLICY } from "@/lib/asset-separation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Explicit pack catalog — empty until product packs are defined with Pi amounts. */
const GHC_PACK_CATALOG: Record<
  string,
  { productId: string; ghcAmount: number; piAmount: number }
> = {
  // Intentionally empty in this release.
  // Example future entry:
  // ghc_pack_100: { productId: "ghc_pack_100", ghcAmount: 100, piAmount: 1 },
}

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
        message:
          "Buy GHC with π is not enabled. Pack catalog and ledger credit path must be production-ready first.",
        policy: ASSET_POLICY.payCopy,
        packsDefined: Object.keys(GHC_PACK_CATALOG).length,
      },
      { status: 503 }
    )
  }

  if (Object.keys(GHC_PACK_CATALOG).length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "PACK_CATALOG_EMPTY",
        message:
          "No GHC packs are defined. Refusing to credit ledger without an authoritative pack catalog.",
        granted: false,
      },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const intentId = String(body.intentId || "").trim()
  const paymentId = String(body.paymentId || "").trim()
  const productId = String(body.productId || body.packId || "").trim()

  if (!intentId) {
    return NextResponse.json({ ok: false, error: "intentId required" }, { status: 400 })
  }

  const intent =
    (await loadPaymentIntent(intentId)) || getPaymentIntent(intentId)
  if (!intent || intent.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "INTENT_NOT_FOUND" }, { status: 404 })
  }
  if (intent.status !== "COMPLETED") {
    return NextResponse.json(
      { ok: false, error: "INTENT_NOT_COMPLETED", status: intent.status },
      { status: 409 }
    )
  }

  const pack =
    (productId && GHC_PACK_CATALOG[productId]) ||
    (intent.metadata?.productId
      ? GHC_PACK_CATALOG[String(intent.metadata.productId)]
      : undefined)

  if (!pack) {
    return NextResponse.json(
      {
        ok: false,
        error: "UNKNOWN_PACK",
        message: "Payment completed but pack is not in the server catalog. No GHC credited.",
        granted: false,
      },
      { status: 400 }
    )
  }

  if (Number(intent.amount) !== pack.piAmount) {
    return NextResponse.json(
      {
        ok: false,
        error: "AMOUNT_mismatch",
        message: "Pi payment amount does not match pack catalog.",
        granted: false,
      },
      { status: 409 }
    )
  }

  if (paymentId && intent.providerPaymentId && paymentId !== intent.providerPaymentId) {
    return NextResponse.json({ ok: false, error: "payment_mismatch", granted: false }, { status: 409 })
  }

  // Ledger credit path for Pi→GHC packs is intentionally not auto-enabled.
  // Enabling requires a dedicated durable credit RPC + pack config review.
  return NextResponse.json(
    {
      ok: false,
      error: "LEDGER_CREDIT_NOT_WIRED",
      message:
        "Pack matched and Pi payment verified, but server ledger credit for GHC packs is not enabled. No balance was changed.",
      intentId,
      productId: pack.productId,
      amountPi: intent.amount,
      ghcAmount: pack.ghcAmount,
      granted: false,
    },
    { status: 503 }
  )
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    enabled: process.env.GHC_BUY_WITH_PI_ENABLED === "true",
    packs: Object.values(GHC_PACK_CATALOG),
    message:
      Object.keys(GHC_PACK_CATALOG).length === 0
        ? "No GHC packs defined. Purchase remains unavailable."
        : "Pack catalog present; enable only after ledger credit is wired.",
  })
}
