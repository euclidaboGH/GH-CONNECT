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
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

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

const MAX_INTENT_BODY_CHARS = 16_384
const MAX_METADATA_CHARS = 8_192
const MAX_REFERENCE_ID_CHARS = 200
const MAX_IDEMPOTENCY_KEY_CHARS = 128
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  }

  pruneRateLimitBuckets()
  const limit = checkRateLimit(`payment-intent:create:${auth.userId}`, 12, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSec) } },
    )
  }

  // Bound request parsing before JSON decoding to avoid unnecessarily large payloads.
  const rawBody = await request.text().catch(() => "")
  if (rawBody.length > MAX_INTENT_BODY_CHARS) {
    return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: NO_STORE })
  }
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_BODY")
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON_BODY" }, { status: 400, headers: NO_STORE })
  }

  const purpose = String(body.purpose || "other") as PaymentPurpose
  if (!PURPOSES.has(purpose)) {
    return NextResponse.json({ ok: false, error: "INVALID_PURPOSE" }, { status: 400, headers: NO_STORE })
  }

  // JSON booleans/null and blank strings must not become numeric amounts via
  // JavaScript coercion. Keep the accepted representation decimal and bounded.
  const rawAmount = body.amount
  const amountString = typeof rawAmount === "string" ? rawAmount.trim() : ""
  const amountFormatValid = typeof rawAmount === "number"
    ? Number.isFinite(rawAmount)
    : typeof rawAmount === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(amountString)
  const amount = typeof rawAmount === "number" ? rawAmount : amountFormatValid ? Number(amountString) : Number.NaN
  if (!amountFormatValid || !Number.isFinite(amount) || amount <= 0 || amount > 10_000 || Number(amount.toFixed(8)) !== amount) {
    return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400, headers: NO_STORE })
  }

  if (body.metadata !== undefined && (!body.metadata || typeof body.metadata !== "object" || Array.isArray(body.metadata))) {
    return NextResponse.json({ ok: false, error: "INVALID_METADATA" }, { status: 400, headers: NO_STORE })
  }
  const metadata = typeof body.metadata === "object" && body.metadata
    ? body.metadata as Record<string, unknown>
    : {}
  let metadataSize = 0
  try {
    metadataSize = JSON.stringify(metadata).length
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_METADATA" }, { status: 400, headers: NO_STORE })
  }
  if (metadataSize > MAX_METADATA_CHARS) {
    return NextResponse.json({ ok: false, error: "METADATA_TOO_LARGE" }, { status: 400, headers: NO_STORE })
  }
  // GHC pack intents carry reserved server-side catalog bindings and must be
  // created through /api/economy/packs/intent, which derives price and amount.
  if (purpose === "digital_product" && String(metadata.kind || "") === "ghc_pack") {
    return NextResponse.json(
      { ok: false, error: "USE_GHC_PACK_INTENT_ROUTE", message: "GHC pack intents must use the server-owned pack catalog." },
      { status: 400, headers: NO_STORE },
    )
  }

  const rawReferenceId = body.referenceId ?? body.orderId
  if (typeof rawReferenceId !== "string") {
    return NextResponse.json({ ok: false, error: "INVALID_REFERENCE_ID" }, { status: 400, headers: NO_STORE })
  }
  const referenceId = rawReferenceId.trim()
  if (!referenceId) {
    return NextResponse.json({ ok: false, error: "INVALID_REFERENCE_ID" }, { status: 400, headers: NO_STORE })
  }
  if (/[\u0000-\u001f\u007f]/.test(referenceId)) {
    return NextResponse.json({ ok: false, error: "INVALID_REFERENCE_ID" }, { status: 400, headers: NO_STORE })
  }
  if (referenceId.length > MAX_REFERENCE_ID_CHARS) {
    return NextResponse.json({ ok: false, error: "REFERENCE_ID_TOO_LONG" }, { status: 400, headers: NO_STORE })
  }
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined
  if (idempotencyKey && (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_CHARS || /[\u0000-\u001f\u007f]/.test(idempotencyKey))) {
    return NextResponse.json({ ok: false, error: "INVALID_IDEMPOTENCY_KEY" }, { status: 400, headers: NO_STORE })
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
      { status: 400, headers: NO_STORE }
    )
  }
  if (requestedCurrency !== "PI") {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_PAYMENT_CURRENCY", supported: ["PI"] },
      { status: 400, headers: NO_STORE },
    )
  }

  const intent = await createPaymentIntent({
    userId: auth.userId,
    purpose,
    amount,
    currency: "PI",
    referenceId,
    metadata,
    idempotencyKey,
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
  pruneRateLimitBuckets()
  const limit = checkRateLimit(`payment-intent:list:${auth.userId}`, 60, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSec), "x-request-id": reqCtx.requestId } },
    )
  }

  // Durable when Supabase configured — survives Vercel cold start / multi-instance
  // Scoped to authenticated user only — never accept client userId override
  try {
    const allUserIntents = await listIntentsForUserAsync(auth.userId)
    // This endpoint powers the Pi payment-history rail only. Internal GHC and
    // manual/provider records must never leak into the Pi transaction timeline.
    const intents = allUserIntents.filter((intent) => intent.provider === "pi" && intent.currency === "PI")
    return NextResponse.json(
      { ok: true, rail: "PI", intents },
      {
        headers: {
          ...NO_STORE,
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
          ...NO_STORE,
          "x-request-id": reqCtx.requestId,
        },
      }
    )
  }
}
