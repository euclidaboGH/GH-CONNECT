/**
 * POST /api/social/tips — create durable tip intents.
 * PI tips wait for verified provider settlement; GHC tips use the feature-gated atomic ledger transfer.
 * Recipient is derived from content when contentId is provided.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  createTipIntent,
  resolvePostAuthor,
} from "@/lib/server/creator/store"
import { createPaymentIntent, assertDurableWrite, loadPaymentIntent } from "@/lib/server/payments/intent-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { attachLedgerCorrelation, buildCorrelationEnvelope } from "@/lib/server/economy/correlation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`tips:${auth.userId}`, 15, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  let body: {
    contentId?: string
    recipientUserId?: string
    currency?: string
    amount?: number
    note?: string
    idempotencyKey?: string
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const currency = String(body.currency || "PI").toUpperCase()
  if (currency !== "PI" && currency !== "GHC") {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_TIP_CURRENCY" }, { status: 400 })
  }
  // The atomic GHC path is implemented but remains off by default until its migration,
  // ledger concurrency suite, and Testnet verification have all passed.
  if (currency === "GHC" && process.env.GHC_TIPS_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "GHC_TIP_RAIL_NOT_ENABLED", message: "GHC tips remain disabled until the atomic transfer migration is applied and verified on Testnet. No GHC balance was changed." }, { status: 409 })
  }
  const amount = Number(body.amount)
  const precision = currency === "GHC" ? 1e4 : 1e8
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000 || Math.round(amount * precision) !== amount * precision) {
    return NextResponse.json({ ok: false, error: currency === "GHC" ? "VALID_GHC_TIP_AMOUNT_REQUIRED" : "VALID_PI_TIP_AMOUNT_REQUIRED" }, { status: 400 })
  }

  let recipientId = ""
  let contentKind = "profile"
  const contentId = body.contentId ? String(body.contentId).trim() : ""

  if (contentId) {
    const post = await resolvePostAuthor(contentId)
    if (!post.ok || !post.authorId) {
      return NextResponse.json(
        { ok: false, error: post.error || "CONTENT_NOT_FOUND" },
        { status: 404 }
      )
    }
    recipientId = post.authorId
    contentKind = "post"
  } else if (body.recipientUserId) {
    // Profile tip: recipient must still pass tips_enabled check in RPC
    recipientId = String(body.recipientUserId).trim()
    contentKind = "profile"
  } else {
    return NextResponse.json(
      { ok: false, error: "RECIPIENT_OR_CONTENT_REQUIRED" },
      { status: 400 }
    )
  }

  if (recipientId === auth.userId) {
    return NextResponse.json({ ok: false, error: "SELF_TIP_FORBIDDEN" }, { status: 400 })
  }

  // One durable intent per tipper + recipient/content. PI binds a provider payment intent;
  // GHC uses the atomic, balance-funded ledger-transfer RPC below.
  const idem = contentId
    ? `tip:${auth.userId}:post:${contentId}:${currency}:amt:${amount.toFixed(currency === "GHC" ? 4 : 8)}`
    : `tip:${auth.userId}:profile:${recipientId}:${currency}:amt:${amount.toFixed(currency === "GHC" ? 4 : 8)}`

  const result = await createTipIntent({
    tipperId: auth.userId,
    recipientId,
    idempotencyKey: idem.slice(0, 200),
    contentId: contentId || undefined,
    contentKind,
    currency,
    amountUnits: amount,
    note: body.note ? String(body.note).slice(0, 280) : undefined,
  })

  if (!result.ok) {
    const status =
      result.error === "RECIPIENT_NOT_TIPPABLE"
        ? 400
        : result.error === "SELF_TIP_FORBIDDEN"
          ? 400
          : 400
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  if (currency === "GHC") {
    const env = readGhcServerEnv()
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "GHC_TIP_SETTLEMENT_UNAVAILABLE", retryable: true }, { status: 503 })
    try {
      const settledResponse = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_tip_settle_ghc_atomic`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
        body: JSON.stringify({ p_tip_intent_id: result.intentId, p_tipper_id: auth.userId, p_amount: amount }), cache: "no-store",
      })
      const settled = await settledResponse.json().catch(() => null) as { ok?: boolean; error?: string; idempotent?: boolean; settlementId?: string; transferReference?: string; amount?: number; currency?: string; creatorPaid?: boolean } | null
      if (!settledResponse.ok || settled?.ok !== true || settled.currency !== "GHC" || Number(settled.amount) !== amount || settled.creatorPaid !== true) {
        const error = String(settled?.error || "GHC_TIP_SETTLEMENT_UNAVAILABLE")
        const status = ["INSUFFICIENT_BALANCE", "TRANSFER_LIMIT_EXCEEDED", "ACCOUNT_RESTRICTED", "BLOCKED_USER", "IDEMPOTENCY_CONFLICT", "SELF_TRANSFER"].includes(error) ? 409 : 503
        return NextResponse.json({ ok: false, error, retryable: status === 503, intentId: result.intentId }, { status })
      }
      const transferReference = String(settled.transferReference || "")
      if (transferReference) {
        await Promise.allSettled([
          attachLedgerCorrelation({ userId: auth.userId, referenceId: transferReference, envelope: buildCorrelationEnvelope({ kind: "creator_tip", event: "CREATOR_TIP_SENT", postId: contentId || undefined, tipIntentId: result.intentId, counterpartyId: recipientId }) }),
          attachLedgerCorrelation({ userId: recipientId, referenceId: transferReference, envelope: buildCorrelationEnvelope({ kind: "creator_tip", event: "CREATOR_TIP_RECEIVED", postId: contentId || undefined, tipIntentId: result.intentId, counterpartyId: auth.userId }) }),
        ])
      }
      return NextResponse.json({ ok: true, durable: true, intentId: result.intentId, status: "settled", settlement: "atomic_ghc_transfer", settlementId: settled.settlementId, transferReference: settled.transferReference, amount, currency: "GHC", creatorPaid: true, duplicate: Boolean(result.duplicate || settled.idempotent) })
    } catch {
      return NextResponse.json({ ok: false, error: "GHC_TIP_SETTLEMENT_UNAVAILABLE", retryable: true, intentId: result.intentId }, { status: 503 })
    }
  }

  if (result.duplicate && result.status === "settled") {
    return NextResponse.json({ ok: true, durable: true, intentId: result.intentId, status: result.status, settlement: "settled", creatorPaid: false, duplicate: true })
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "TIP_SETTLEMENT_UNAVAILABLE", retryable: true }, { status: 503 })

  // Recover the durable binding before creating anything new. This makes retries safe across
  // serverless instances where process-memory idempotency caches are not shared.
  try {
    const lookup = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_tip_intent_get_for_tipper`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_tipper_id: auth.userId, p_tip_intent_id: result.intentId }), cache: "no-store",
    })
    const found = await lookup.json().catch(() => null) as { ok?: boolean; amount?: number; currency?: string; paymentIntentId?: string | null; status?: string } | null
    if (!lookup.ok || found?.ok !== true) return NextResponse.json({ ok: false, error: "TIP_INTENT_LOOKUP_UNAVAILABLE", retryable: true }, { status: 503 })
    if (Number(found.amount) !== amount || found.currency !== "PI") return NextResponse.json({ ok: false, error: "TIP_INTENT_AMOUNT_CONFLICT" }, { status: 409 })
    if (found.paymentIntentId) {
      const existingPayment = await loadPaymentIntent(String(found.paymentIntentId))
      if (!existingPayment || existingPayment.userId !== auth.userId || existingPayment.purpose !== "creator_earning" || existingPayment.amount !== amount || existingPayment.metadata?.tipIntentId !== result.intentId) {
        return NextResponse.json({ ok: false, error: "TIP_PAYMENT_BINDING_UNAVAILABLE", retryable: true }, { status: 503 })
      }
      return NextResponse.json({ ok: true, durable: true, intentId: result.intentId, paymentIntent: existingPayment, status: found.status, settlement: found.status === "settled" ? "settled" : "awaiting_pi_confirmation", completed: found.status === "settled", creatorPaid: false, duplicate: true })
    }
  } catch {
    return NextResponse.json({ ok: false, error: "TIP_INTENT_LOOKUP_UNAVAILABLE", retryable: true }, { status: 503 })
  }

  let paymentIntent
  try {
    paymentIntent = await createPaymentIntent({
      userId: auth.userId,
      purpose: "creator_earning",
      amount,
      currency: "PI",
      referenceId: `tip:${result.intentId}`,
      metadata: { flow: "creator_tip", tipIntentId: result.intentId, recipientId, contentId: contentId || null },
      idempotencyKey: `creator-tip:${result.intentId}`,
      provider: "pi",
    })
  } catch {
    return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_UNAVAILABLE", tipIntentId: result.intentId, retryable: true }, { status: 503 })
  }
  const durable = await assertDurableWrite(paymentIntent)
  if (!durable.ok) return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_UNAVAILABLE", tipIntentId: result.intentId, retryable: true }, { status: 503 })

  try {
    const bind = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_tip_intent_bind_payment_intent`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_tipper_id: auth.userId, p_tip_intent_id: result.intentId, p_payment_intent_id: paymentIntent.id }), cache: "no-store",
    })
    const bindResult = await bind.json().catch(() => null) as { ok?: boolean; error?: string } | null
    if (!bind.ok || bindResult?.ok !== true) return NextResponse.json({ ok: false, error: bindResult?.error || "TIP_PAYMENT_BIND_FAILED", retryable: true }, { status: 503 })
  } catch {
    return NextResponse.json({ ok: false, error: "TIP_PAYMENT_BIND_FAILED", retryable: true }, { status: 503 })
  }

  return NextResponse.json({
    ok: true, durable: true, intentId: result.intentId, paymentIntent,
    status: "awaiting_payment", settlement: "awaiting_pi_confirmation", completed: false,
    creatorPaid: false,
    message: "Tip intent and Pi payment intent are durably linked. Creator payable is recorded only after Pi confirms the completed payment; creator payout is a separate reconciled operation.",
  })
}
