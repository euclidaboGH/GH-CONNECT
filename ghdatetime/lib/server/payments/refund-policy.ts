/**
 * Phase 4 — refund / dispute policy helpers (server).
 * Refunds never invent balances; they reverse verified payments under rules.
 */

export type RefundDecision =
  | { allowed: true; mode: "full" | "partial"; note: string }
  | { allowed: false; code: string; message: string }

export function evaluateMarketplaceRefund(input: {
  orderStatus: string
  paymentStatus: string
  completedAt?: number
  /** Hours after completion within which buyer can request refund without seller dispute */
  windowHours?: number
}): RefundDecision {
  const status = String(input.orderStatus || "").toLowerCase()
  const pay = String(input.paymentStatus || "").toLowerCase()

  if (pay !== "verified" && status !== "completed" && status !== "payment_verified") {
    return {
      allowed: false,
      code: "NOT_PAID",
      message: "Refund only applies after verified payment",
    }
  }
  if (status === "refunded") {
    return { allowed: false, code: "ALREADY_REFUNDED", message: "Order already refunded" }
  }
  if (status === "cancelled" && pay !== "verified") {
    return { allowed: false, code: "NO_CAPTURE", message: "Nothing to refund" }
  }

  const windowH = Number.isFinite(input.windowHours) ? Number(input.windowHours) : 72
  if (input.completedAt && input.completedAt > 0) {
    const deadline = input.completedAt + windowH * 3600 * 1000
    if (Date.now() > deadline) {
      return {
        allowed: false,
        code: "WINDOW_CLOSED",
        message: `Buyer self-serve refund window (${windowH}h) closed — use dispute path`,
      }
    }
  }

  return {
    allowed: true,
    mode: "full",
    note: "Eligible for refund workflow; execute only after operator or automated provider reverse + ledger adjust.",
  }
}

export function refundPolicyPublic() {
  return {
    buyerSelfServeHours: 72,
    requiresVerifiedPayment: true,
    ghcOrders: "Reverse via ledger credit/debit pair with same reference — never client balance writes",
    piOrders: "Provider refund / A2U path only after eligibility checks",
  }
}
