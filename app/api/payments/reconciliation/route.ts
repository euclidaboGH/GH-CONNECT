/**
 * GET /api/payments/reconciliation
 * Read-only, user-scoped reconciliation between Pi payment intents and the
 * authoritative feature records that currently expose verified mappings.
 * Never mutates payments, orders, entitlements, balances, or fulfilment state.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { listIntentsForUserAsync, PAYMENT_INTENT_HISTORY_LIMIT } from "@/lib/server/payments/intent-store"
import { loadOrder, marketplaceOrdersDurable } from "@/lib/server/marketplace/order-store"
import { tryGetEntitlementAuthoritative } from "@/lib/server/membership/entitlement-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" }
type Finding = {
  intentId: string
  purpose: string
  referenceId: string
  paymentStatus: string
  reconciliation: "matched" | "attention_required" | "unverified" | "not_applicable"
  code: string
  message: string
  featureStatus?: string
}

function terminalPayment(status: string): boolean {
  return ["FULFILLED", "FAILED", "CANCELLED", "REFUNDED"].includes(status)
}

/**
 * Bound concurrent feature-store lookups. A single user can have up to 100
 * intents in the durable store; unbounded Promise.all fan-out can otherwise
 * burst the marketplace database and amplify transient outages.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error("INVALID_RECONCILIATION_CONCURRENCY")
  }
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  }))
  return results
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })

  // Reconciliation is read-only but can trigger multiple durable feature-store reads.
  // Limit repeated diagnostic polling per user to reduce avoidable database load.
  pruneRateLimitBuckets()
  const limit = checkRateLimit(`payment-reconciliation:${auth.userId}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSec) } },
    )
  }

  try {
    const allUserIntents = await listIntentsForUserAsync(auth.userId)
    // Reconcile only Pi-provider intents here; GHC/internal records belong to
    // the GHC ledger and must not be reported as Pi purchase fulfilment.
    // The underlying store currently returns at most 100 newest records. Expose
    // that bound so a full page is never misrepresented as a complete lifetime audit.
    const historyLimit = PAYMENT_INTENT_HISTORY_LIMIT
    const potentiallyTruncated = allUserIntents.length >= historyLimit
    // Defense in depth: do not let a future store implementation accidentally
    // leak cross-user rows into a reconciliation report.
    const intents = allUserIntents.filter((intent) => intent.userId === auth.userId && intent.provider === "pi" && intent.currency === "PI")
    // Membership entitlement is user-scoped and singular. Load it once rather
    // than issuing the same durable lookup concurrently for every old intent.
    // This avoids an N+1 query pattern for users with long payment histories.
    const hasMembershipIntents = intents.some((intent) => intent.purpose === "membership")
    const membershipState = hasMembershipIntents
      ? await tryGetEntitlementAuthoritative(auth.userId)
      : null
    const findings: Finding[] = await mapWithConcurrency(intents, 5, async (intent): Promise<Finding> => {
      const base = {
        intentId: intent.id,
        purpose: intent.purpose,
        referenceId: intent.referenceId,
        paymentStatus: intent.status,
      }
      const status = String(intent.status || "").toUpperCase()

      if (intent.purpose === "marketplace") {
        if (!marketplaceOrdersDurable()) {
          return { ...base, reconciliation: "unverified", code: "MARKETPLACE_STORE_NOT_DURABLE", message: "Marketplace order store is not configured for authoritative reconciliation." }
        }
        if (!intent.referenceId) {
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_REFERENCE_MISSING", message: "Payment intent has no order reference." }
        }
        // Marketplace callers historically use either the canonical order ID or
        // the ledger-compatible `market_order_<id>` reference. Normalize only this
        // explicit, known prefix; never guess arbitrary reference formats.
        const orderId = intent.referenceId.startsWith("market_order_")
          ? intent.referenceId.slice("market_order_".length)
          : intent.referenceId
        if (!orderId || orderId.length > 200 || /[\u0000-\u001f\u007f]/.test(orderId)) {
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_REFERENCE_INVALID", message: "The marketplace payment reference is malformed and cannot be safely resolved." }
        }
        const order = await loadOrder(orderId)
        if (!order) {
          return { ...base, reconciliation: "unverified", code: "MARKETPLACE_ORDER_UNAVAILABLE", message: "The referenced order could not be authoritatively loaded; absence is not treated as proof of failure." }
        }
        if (order.id !== orderId || ![order.id, `market_order_${order.id}`].includes(intent.referenceId)) {
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_REFERENCE_MISMATCH", message: "The payment reference does not canonically identify the loaded marketplace order." }
        }
        if (order.buyerId !== auth.userId) {
          // Do not disclose another user's order state through a crafted intent reference.
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_OWNER_MISMATCH", message: "The referenced order is not available as a buyer-owned order for this account." }
        }
        const intentLinkMatches = order.paymentIntentId === intent.id
        const providerLinkMatches = !!intent.providerPaymentId && order.paymentId === intent.providerPaymentId
        // A positive match on one identifier must not mask a contradictory second
        // identifier. That can indicate an accidental cross-order payment binding.
        const intentLinkConflicts = !!order.paymentIntentId && !intentLinkMatches
        const providerLinkConflicts = !!order.paymentId && !!intent.providerPaymentId && !providerLinkMatches
        if (intentLinkConflicts || providerLinkConflicts) {
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_PAYMENT_LINK_CONFLICT", message: "The order contains a payment identifier that conflicts with this intent.", featureStatus: order.status }
        }
        const linked = intentLinkMatches || providerLinkMatches
        if (!linked) {
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_PAYMENT_LINK_MISMATCH", message: "Order exists, but its stored payment identifiers do not match this intent.", featureStatus: order.status }
        }
        const orderAmount = Number(order.totalAmount)
        const intentAmount = Number(intent.amount)
        const amountMatches = Number.isFinite(orderAmount) && orderAmount > 0
          && Number.isFinite(intentAmount) && intentAmount > 0
          && Math.abs(orderAmount - intentAmount) <= 0.001
        const piRailMatches = order.paymentMethod === "pi" && String(order.currency).toUpperCase() === "PI"
        if (!amountMatches || !piRailMatches) {
          return { ...base, reconciliation: "attention_required", code: !amountMatches ? "MARKETPLACE_AMOUNT_MISMATCH" : "MARKETPLACE_RAIL_MISMATCH", message: !amountMatches
            ? "Linked records have missing, invalid, or inconsistent payment amounts; verify the authoritative order and intent before taking action."
            : "Linked records disagree about the payment rail or currency; do not treat this as a verified Pi settlement.", featureStatus: `${order.status}/${order.paymentStatus}` }
        }
        const paid = order.paymentStatus === "verified"
        if (status === "FULFILLED" && paid && order.status === "completed") {
          return { ...base, reconciliation: "matched", code: "MARKETPLACE_ORDER_COMPLETED", message: "Payment intent and buyer-owned marketplace order are linked, amount-matched, and completed.", featureStatus: order.status }
        }
        if (status === "REFUNDED") {
          if (order.paymentStatus === "refunded" && order.status === "refunded") {
            return { ...base, reconciliation: "matched", code: "MARKETPLACE_REFUND_CONFIRMED", message: "The intent and order both record a refunded terminal state.", featureStatus: order.status }
          }
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_REFUND_STATE_MISMATCH", message: "The intent is marked refunded but the order does not confirm the same refund state.", featureStatus: `${order.status}/${order.paymentStatus}` }
        }
        if (status === "FAILED") {
          if (order.paymentStatus === "failed" && !["payment_verified", "confirmed", "fulfilling", "completed"].includes(order.status)) {
            return { ...base, reconciliation: "matched", code: "MARKETPLACE_FAILED_PAYMENT_CONFIRMED", message: "The intent and order both reflect an unsuccessful, unpaid payment state.", featureStatus: order.status }
          }
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_FAILED_PAYMENT_CONFLICT", message: "The intent is failed but the order state does not independently confirm a failed, unpaid payment.", featureStatus: `${order.status}/${order.paymentStatus}` }
        }
        if (status === "CANCELLED") {
          if (order.status === "cancelled" && order.paymentStatus !== "verified" && order.paymentStatus !== "refunded") {
            return { ...base, reconciliation: "matched", code: "MARKETPLACE_CANCELLED_ORDER_CONFIRMED", message: "The intent and order both reflect a cancelled, non-settled purchase.", featureStatus: order.status }
          }
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_CANCELLED_PAYMENT_CONFLICT", message: "The intent is cancelled but the order does not confirm a cancelled, non-settled purchase.", featureStatus: `${order.status}/${order.paymentStatus}` }
        }
        return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_FULFILMENT_NOT_CONFIRMED", message: "Payment and order records are linked, but their terminal states do not yet confirm completed fulfilment.", featureStatus: `${order.status}/${order.paymentStatus}` }
      }

      if (intent.purpose === "membership") {
        const loaded = membershipState
        if (!loaded || !loaded.ok || loaded.source !== "db") {
          return { ...base, reconciliation: "unverified", code: "MEMBERSHIP_STORE_NOT_AUTHORITATIVE", message: "Durable membership entitlement state could not be confirmed; no entitlement conclusion is inferred." }
        }
        const entitlement = loaded.entitlement
        // Pi membership grants store the canonical intent ID and use the provider
        // payment ID (or pi:<intent-id> fallback) as purchaseRef. Do not match a
        // reusable product/reference ID: that could make an older payment appear
        // to have granted the currently active entitlement.
        const linkedByIntent = !!entitlement.paymentIntentId && entitlement.paymentIntentId === intent.id
        const linkedByPurchase = !entitlement.paymentIntentId && !!entitlement.purchaseRef && (
          (!!intent.providerPaymentId && entitlement.purchaseRef === intent.providerPaymentId)
          || entitlement.purchaseRef === `pi:${intent.id}`
        )
        const linked = linkedByIntent || linkedByPurchase
        if (linked && entitlement.tier !== "free" && entitlement.active) {
          if (status === "FULFILLED") return { ...base, reconciliation: "matched", code: "MEMBERSHIP_ENTITLEMENT_LINKED", message: "A durable active membership entitlement references this payment.", featureStatus: entitlement.tier }
          return { ...base, reconciliation: "attention_required", code: "MEMBERSHIP_STATUS_MISMATCH", message: "An entitlement references this payment, but the payment intent is not marked fulfilled.", featureStatus: entitlement.tier }
        }
        if (status === "COMPLETED" || status === "FULFILLED") {
          return { ...base, reconciliation: "attention_required", code: "MEMBERSHIP_ENTITLEMENT_NOT_LINKED", message: "Payment is completed, but the current durable entitlement does not prove fulfilment of this intent.", featureStatus: entitlement.tier }
        }
        if (terminalPayment(status)) {
          return { ...base, reconciliation: "not_applicable", code: "MEMBERSHIP_PAYMENT_TERMINAL", message: "Payment is terminal; no active matching paid entitlement was found.", featureStatus: entitlement.tier }
        }
        return { ...base, reconciliation: "unverified", code: "MEMBERSHIP_PAYMENT_IN_PROGRESS", message: "Membership reconciliation is deferred until the payment reaches a terminal state.", featureStatus: entitlement.tier }
      }

      if (intent.purpose === "creator_earning" || intent.purpose === "seller_payout" || intent.purpose === "reward_payout") {
        return { ...base, reconciliation: "not_applicable", code: "NON_PURCHASE_PAYMENT", message: "This payment category is not reconciled against purchase fulfilment records." }
      }
      return { ...base, reconciliation: "unverified", code: "FEATURE_MAPPING_NOT_IMPLEMENTED", message: "No verified authoritative feature-record mapping is registered for this payment category." }
    })

    const counts = findings.reduce((acc, item) => {
      acc[item.reconciliation]++
      return acc
    }, { matched: 0, attention_required: 0, unverified: 0, not_applicable: 0 })
    return NextResponse.json({
      ok: true,
      readOnly: true,
      scope: "authenticated_user",
      rail: "PI",
      generatedAt: new Date().toISOString(),
      coverage: {
        recordLimit: historyLimit,
        returnedIntentCount: allUserIntents.length,
        reconciledPiIntentCount: intents.length,
        potentiallyTruncated,
        scopeDescription: potentiallyTruncated
          ? "Newest stored payment-intent records only; history may be truncated at the store limit. A full page is a warning, not proof that older records exist."
          : "All payment-intent records returned by the current user-scoped store query; this is not a provider-wide or ledger-wide audit.",
      },
      counts,
      findings,
    }, { headers: noStore })
  } catch {
    return NextResponse.json({ ok: false, error: "PAYMENT_RECONCILIATION_UNAVAILABLE" }, { status: 503, headers: noStore })
  }
}
