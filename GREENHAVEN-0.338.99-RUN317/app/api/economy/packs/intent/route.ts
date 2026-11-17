/**
 * POST /api/economy/packs/intent
 * Create a durable Pi payment intent bound to a GHC pack product.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { buyGhcWithPiEnabled } from "@/lib/server/economy/testnet-unlock"
import { getGhcPack, packPurchaseLimits, lagosDayKey } from "@/lib/server/economy/ghc-pack-catalog"
import { createPaymentIntent, assertDurableWrite } from "@/lib/server/payments/intent-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!buyGhcWithPiEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "BUY_GHC_DISABLED",
        message: "Pack acquisition is not enabled on this deployment.",
      },
      { status: 503 }
    )
  }

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`pack_intent:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    )
  }
  const dayKey = lagosDayKey()
  const dayRl = checkRateLimit(
    `pack_intent_day:${auth.userId}:${dayKey}`,
    packPurchaseLimits().maxPurchasesPerDay,
    24 * 60 * 60 * 1000
  )
  if (!dayRl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "DAILY_PACK_CAP",
        message: `Daily pack limit (${packPurchaseLimits().maxPurchasesPerDay}) reached.`,
      },
      { status: 429 }
    )
  }

  const parsedBody = await readBoundedJson(request, 4 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value
  const productValue = typeof body.productId === "string" ? body.productId : typeof body.packId === "string" ? body.packId : ""
  const productId = productValue.trim()
  const pack = getGhcPack(productId)
  if (!pack) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_PACK" }, { status: 400 })
  }

  const referenceId = `ghc_pack_${pack.productId}:${auth.userId}:${Date.now()}`
  const intent = await createPaymentIntent({
    userId: auth.userId,
    purpose: "digital_product",
    amount: pack.piAmount,
    currency: "PI",
    referenceId,
    metadata: {
      productId: pack.productId,
      ghcAmount: pack.ghcAmount,
      kind: "ghc_pack",
      label: pack.label,
    },
    idempotencyKey:
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined,
    provider: "pi",
  })

  const durable = await assertDurableWrite(intent)
  if (!durable.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: durable.error || "INTENT_NOT_DURABLE",
        message: "Could not persist payment intent",
      },
      { status: 503 }
    )
  }

  return NextResponse.json({
    ok: true,
    intentId: intent.id,
    amountPi: pack.piAmount,
    productId: pack.productId,
    ghcAmount: pack.ghcAmount,
    label: pack.label,
    referenceId,
    policy: ASSET_POLICY.packPurchaseCopy,
    next: "Complete Pi payment for this intent, then POST /api/payments/fulfill or /api/economy/purchase-ghc",
  })
}
