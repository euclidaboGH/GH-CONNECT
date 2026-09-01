/**
 * POST /api/payments/intents — create server-side payment intent before Pi createPayment.
 * GET  /api/payments/intents — list intents for authenticated user.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { createPaymentIntent, listIntentsForUser } from "@/lib/server/payments/intent-store"
import type { PaymentPurpose } from "@/lib/server/payments/intent-types"
import { ASSET_POLICY } from "@/lib/asset-separation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PURPOSES = new Set([
  "membership",
  "marketplace",
  "boost",
  "donation",
  "sponsored_listing",
  "digital_product",
  "premium_feature",
  "service",
  "verification",
  "seller_payout",
  "creator_earning",
  "refund",
  "reward_payout",
  "other",
])

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const purpose = String(body.purpose || "other") as PaymentPurpose
  if (!PURPOSES.has(purpose)) {
    return NextResponse.json({ ok: false, error: "Invalid purpose" }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
  }

  const referenceId = String(body.referenceId || body.orderId || "").trim()
  if (!referenceId) {
    return NextResponse.json({ ok: false, error: "referenceId required" }, { status: 400 })
  }

  // Pi payment intents are π only — GHC uses ledger spend, never this engine
  if (body.currency === "GHC") {
    return NextResponse.json(
      {
        ok: false,
        error: "GHC_NOT_ON_PI_RAILS",
        message: ASSET_POLICY.payCopy,
      },
      { status: 400 }
    )
  }

  const intent = createPaymentIntent({
    userId: auth.userId,
    purpose,
    amount,
    currency: "PI",
    referenceId,
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    idempotencyKey:
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined,
    provider: "pi",
  })

  return NextResponse.json({ ok: true, intent })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const intents = listIntentsForUser(auth.userId)
  return NextResponse.json({ ok: true, intents })
}
