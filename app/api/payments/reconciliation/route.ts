/**
 * GET /api/payments/reconciliation
 * Read-only, user-scoped reconciliation between Pi payment intents and the
 * authoritative feature records that currently expose verified mappings.
 * Never mutates payments, orders, entitlements, balances, or fulfilment state.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { listIntentsForUserAsync } from "@/lib/server/payments/intent-store"
import { loadOrder, marketplaceOrdersDurable } from "@/lib/server/marketplace/order-store"
import { tryGetEntitlementAuthoritative } from "@/lib/server/membership/entitlement-store"

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

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })

  try {
    const intents = await listIntentsForUserAsync(auth.userId)
    // Membership entitlement is user-scoped and singular. Load it once rather
    // than issuing the same durable lookup concurrently for every old intent.
    // This avoids an N+1 query pattern for users with long payment histories.
    const hasMembershipIntents = intents.some((intent) => intent.purpose === "membership")
    const membershipState = hasMembershipIntents
      ? await tryGetEntitlementAuthoritative(auth.userId)
      : null
    const findings: Finding[] = await Promise.all(intents.map(async (intent): Promise<Finding> => {
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
        const order = await loadOrder(intent.referenceId)
        if (!order) {
          return { ...base, reconciliation: "unverified", code: "MARKETPLACE_ORDER_UNAVAILABLE", message: "The referenced order could not be authoritatively loaded; absence is not treated as proof of failure." }
        }
        if (order.buyerId !== auth.userId) {
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_OWNER_MISMATCH", message: "Referenced order does not belong to the authenticated buyer." }
        }
        const linked = order.paymentIntentId === intent.id
          || (!!intent.providerPaymentId && order.paymentId === intent.providerPaymentId)
        if (!linked) {
          return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_PAYMENT_LINK_MISMATCH", message: "Order exists, but its stored payment identifiers do not match this intent.", featureStatus: order.status }
        }
        const paid = order.paymentMethod === "pi" && order.currency.toUpperCase() === "PI"
          && ["verified"].includes(order.paymentStatus)
        if (status === "FULFILLED" && paid && ["completed"].includes(order.status)) {
          return { ...base, reconciliation: "matched", code: "MARKETPLACE_ORDER_COMPLETED", message: "Payment intent and buyer-owned marketplace order are linked and completed.", featureStatus: order.status }
        }
        if (["FAILED", "CANCELLED", "REFUNDED"].includes(status) && !paid) {
          return { ...base, reconciliation: "matched", code: "MARKETPLACE_TERMINAL_UNPAID", message: "Terminal payment status agrees with an order that is not marked paid.", featureStatus: order.status }
        }
        return { ...base, reconciliation: "attention_required", code: "MARKETPLACE_FULFILMENT_NOT_CONFIRMED", message: "Payment and order records are linked, but their terminal states do not yet confirm completed fulfilment.", featureStatus: `${order.status}/${order.paymentStatus}` }
      }

      if (intent.purpose === "membership") {
        const loaded = membershipState
        if (!loaded || !loaded.ok || loaded.source !== "db") {
          return { ...base, reconciliation: "unverified", code: "MEMBERSHIP_STORE_NOT_AUTHORITATIVE", message: "Durable membership entitlement state could not be confirmed; no entitlement conclusion is inferred." }
        }
        const entitlement = loaded.entitlement
        const linked = !!entitlement.paymentIntentId && entitlement.paymentIntentId === intent.id
          || !!entitlement.purchaseRef && entitlement.purchaseRef === intent.referenceId
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
    }))

    const counts = findings.reduce((acc, item) => {
      acc[item.reconciliation]++
      return acc
    }, { matched: 0, attention_required: 0, unverified: 0, not_applicable: 0 })
    return NextResponse.json({
      ok: true,
      readOnly: true,
      scope: "authenticated_user",
      generatedAt: new Date().toISOString(),
      counts,
      findings,
    }, { headers: noStore })
  } catch {
    return NextResponse.json({ ok: false, error: "PAYMENT_RECONCILIATION_UNAVAILABLE" }, { status: 503, headers: noStore })
  }
}
