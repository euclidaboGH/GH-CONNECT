/**
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
 * Phase 3 — Pi-funded GHC pack acquisition (governed product).
 * POST: credit after completed Pi intent matches catalog.
 * GET: list packs + limits + enabled flag.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadPaymentIntent } from "@/lib/server/payments/intent-store"
import { buyGhcWithPiEnabled } from "@/lib/server/economy/testnet-unlock"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import {
  executeAuthoritativePackPurchase,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import {
  getGhcPack,
  listGhcPacks,
  packPurchaseLimits,
  lagosDayKey,
} from "@/lib/server/economy/ghc-pack-catalog"
import { ASSET_POLICY } from "@/lib/asset-separation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function rpcCreditPackPurchase(input: {
  userId: string
  amount: number
  referenceId: string
  reason: string
  productId: string
  intentId: string
}): Promise<{ ok: boolean; transactionId?: string; alreadyCredited?: boolean; error?: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_credit_pack_purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_user_id: input.userId,
          p_amount: input.amount,
          p_reference_id: input.referenceId,
          p_reason: input.reason,
          p_product_id: input.productId,
          p_intent_id: input.intentId,
        }),
      }
    )
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) {
      return {
        ok: false,
        error:
          data && typeof data === "object" && "message" in data
            ? String(data.message)
            : "CREDIT_RPC_FAILED",
      }
    }
    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || data.code || "CREDIT_DENIED") }
    }
    return {
      ok: true,
      transactionId: data?.transactionId != null ? String(data.transactionId) : undefined,
      alreadyCredited: Boolean(data?.alreadyCredited || data?.idempotent),
    }
  } catch {
    return { ok: false, error: "CREDIT_RPC_FAILED" }
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  if (!buyGhcWithPiEnabled()) {
    return jsonErr(
      "BUY_GHC_DISABLED",
      "Pi→GHC packs disabled. Set GHC_BUY_WITH_PI_ENABLED or GHC_TESTNET_UNLOCK.",
      503
    )
  }

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`purchase_ghc:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many purchase attempts; retry in ${rl.retryAfterSec}s`, 429)
  }

  // Soft daily purchase rate limit (count attempts, not only success)
  const dayKey = lagosDayKey()
  const dayRl = checkRateLimit(
    `purchase_ghc_day:${auth.userId}:${dayKey}`,
    packPurchaseLimits().maxPurchasesPerDay,
    24 * 60 * 60 * 1000
  )
  if (!dayRl.ok) {
    return jsonErr(
      "DAILY_PACK_CAP",
      `Daily pack purchase limit reached (${packPurchaseLimits().maxPurchasesPerDay}). Retry tomorrow.`,
      429
    )
  }

  const parsedBody = await readBoundedJson(request, 8192)
  if (!parsedBody.ok) {
    return jsonErr(
      parsedBody.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_INPUT",
      parsedBody.error === "REQUEST_TOO_LARGE" ? "Request body exceeds the allowed size" : "Invalid purchase request body",
      parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400,
    )
  }
  const body = parsedBody.value

  const intentId = String(body.intentId || "").trim()
  const paymentId = String(body.paymentId || "").trim()
  const productId = String(body.productId || body.packId || "").trim()

  if (!intentId) {
    return jsonErr("INVALID_INPUT", "intentId required", 400)
  }

  const intent = await loadPaymentIntent(intentId)
  if (!intent || intent.userId !== auth.userId) {
    return jsonErr("INTENT_NOT_FOUND", "Payment intent not found", 404)
  }
  if (intent.status !== "COMPLETED" && intent.status !== "FULFILLED") {
    return NextResponse.json(
      { ok: false, error: "INTENT_NOT_COMPLETED", status: intent.status },
      { status: 409 }
    )
  }
  // A completed PI intent for some other product is not proof of a GHC pack
  // purchase. Require the dedicated server-created pack binding, including the
  // exact catalog product, PI rail, purpose, user-scoped reference and amount.
  if (
    intent.provider !== "pi" ||
    intent.currency !== "PI" ||
    intent.purpose !== "digital_product" ||
    intent.metadata?.kind !== "ghc_pack" ||
    !intent.providerPaymentId
  ) {
    return NextResponse.json({ ok: false, error: "PACK_INTENT_BINDING_MISMATCH", granted: false }, { status: 409 })
  }

  const pack =
    getGhcPack(productId) ||
    (intent.metadata?.productId ? getGhcPack(String(intent.metadata.productId)) : null)

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

  if (
    Number(intent.amount) !== pack.piAmount ||
    String(intent.metadata?.productId || "") !== pack.productId ||
    Number(intent.metadata?.ghcAmount) !== pack.ghcAmount ||
    !intent.referenceId.startsWith(`ghc_pack_${pack.productId}:${auth.userId}:`)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "AMOUNT_MISMATCH",
        message: "Pi payment amount does not match pack catalog.",
        granted: false,
      },
      { status: 409 }
    )
  }

  if (paymentId && intent.providerPaymentId && paymentId !== intent.providerPaymentId) {
    return NextResponse.json({ ok: false, error: "PAYMENT_MISMATCH", granted: false }, { status: 409 })
  }

  const referenceId = `pi_pack:${intentId}:${pack.productId}`
  const reason = `Pi pack ${pack.label}`

  if (isDatabaseConfigured()) {
    const credit = await rpcCreditPackPurchase({
      userId: auth.userId,
      amount: pack.ghcAmount,
      referenceId,
      reason,
      productId: pack.productId,
      intentId,
    })
    if (credit.ok) {
      return jsonOk({
        ok: true,
        granted: true,
        alreadyCredited: credit.alreadyCredited,
        transactionId: credit.transactionId,
        productId: pack.productId,
        ghcAmount: pack.ghcAmount,
        amountPi: pack.piAmount,
        intentId,
        policy: ASSET_POLICY.packPurchaseCopy,
      })
    }
    if (!(allowMemoryServer() && /CREDIT_RPC|function|does not exist/i.test(credit.error || ""))) {
      return NextResponse.json(
        {
          ok: false,
          error: credit.error || "CREDIT_FAILED",
          message: "Could not credit GHC for verified Pi payment.",
          granted: false,
        },
        { status: 503 }
      )
    }
  }

  if (allowMemoryServer()) {
    const store = getProcessGhcStore()
    const result = await executeAuthoritativePackPurchase(store, {
      userId: auth.userId,
      amount: pack.ghcAmount,
      referenceId,
      reason,
      productId: pack.productId,
      intentId,
    })
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "CREDIT_FAILED", granted: false },
        { status: 400 }
      )
    }
    return jsonOk({
      ok: true,
      granted: true,
      alreadyCredited: Boolean(result.idempotent),
      transactionId: result.tx.id,
      productId: pack.productId,
      ghcAmount: pack.ghcAmount,
      amountPi: pack.piAmount,
      intentId,
      mode: "memory",
      policy: ASSET_POLICY.packPurchaseCopy,
    })
  }

  return jsonErr(
    "SERVER_UNAVAILABLE",
    "Apply migration ghc_credit_pack_purchase or enable studio memory economy",
    503
  )
}

export async function GET() {
  const enabled = buyGhcWithPiEnabled()
  return NextResponse.json({
    ok: true,
    enabled,
    product: "governed_utility_pack",
    conversionEnabled: ASSET_POLICY.conversionEnabled,
    policy: ASSET_POLICY.packPurchaseCopy,
    limits: packPurchaseLimits(),
    packs: listGhcPacks(),
    message: enabled
      ? "Complete a Pi payment intent for a catalog pack, then POST intentId + productId to credit GHC."
      : "Set GHC_BUY_WITH_PI_ENABLED=true or GHC_TESTNET_UNLOCK=1 to enable packs.",
  })
}
