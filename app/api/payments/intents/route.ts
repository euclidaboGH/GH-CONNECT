/**
 * POST /api/payments/intents — create server-side payment intent before Pi createPayment.
 * GET  /api/payments/intents — list intents for authenticated user.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getRequestContext } from "@/lib/server/foundation/request-context"
import { createPaymentIntent, listIntentsForUserAsync } from "@/lib/server/payments/intent-store"
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

  const metadata = typeof body.metadata === "object" && body.metadata && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : {}
  // GHC pack intents carry reserved server-side catalog bindings and must be
  // created through /api/economy/packs/intent, which derives price and amount.
  if (purpose === "digital_product" && String(metadata.kind || "") === "ghc_pack") {
    return NextResponse.json(
      { ok: false, error: "USE_GHC_PACK_INTENT_ROUTE", message: "GHC pack intents must use the server-owned pack catalog." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const referenceId = String(body.referenceId || body.orderId || "").trim()
  if (!referenceId) {
    return NextResponse.json({ ok: false, error: "referenceId required" }, { status: 400 })
  }

  // This route creates Pi-provider intents only. Reject other rails explicitly
  // instead of silently coercing a typo (or lowercase GHC) into a Pi payment.
  const requestedCurrency = String(body.currency || "PI").trim().toUpperCase()
  if (requestedCurrency === "GHC") {
    return NextResponse.json(
      {
        ok: false,
        error: "GHC_NOT_ON_PI_RAILS",
        message: ASSET_POLICY.payCopy,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
  if (requestedCurrency !== "PI") {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_PAYMENT_CURRENCY", supported: ["PI"] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const intent = await createPaymentIntent({
    userId: auth.userId,
    purpose,
    amount,
    currency: "PI",
    referenceId,
    metadata,
    idempotencyKey:
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined,
    provider: "pi",
  })

  // Production must persist intent before client may create Pi payment
  const { assertDurableWrite } = await import("@/lib/server/payments/intent-store")
  const durable = await assertDurableWrite(intent)
  if (!durable.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_UNAVAILABLE",
        message:
          durable.error ||
          "Payment intents require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY with pi_payment_intents migration applied.",
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ ok: true, intent })
}

export async function GET(request: Request) {
  const reqCtx = getRequestContext(request.headers)

  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "AUTH_REQUIRED" },
      { status: 401, headers: { "x-request-id": reqCtx.requestId } }
    )
  }
  // Durable when Supabase configured — survives Vercel cold start / multi-instance
  // Scoped to authenticated user only — never accept client userId override
  try {
    const intents = await listIntentsForUserAsync(auth.userId)
    return NextResponse.json(
      { ok: true, intents },
      {
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": reqCtx.requestId,
        },
      }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PAYMENT_INTENT_STORE_UNAVAILABLE"
    const code = msg.includes("PAYMENT_INTENT") ? msg : "PAYMENT_INTENT_STORE_UNAVAILABLE"
    return NextResponse.json(
      { ok: false, error: code },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": reqCtx.requestId,
        },
      }
    )
  }
}
