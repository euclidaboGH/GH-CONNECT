/**
 * Phase 2 — buyer-facing return / dispute guidance.
 * Guidance only: it never changes an order. Actual transitions go through the
 * existing authenticated order transition API.
 */
export const RETURN_WINDOW_DAYS = 7

export type ReturnStage = "not_eligible" | "before_delivery" | "return_window" | "window_closed" | "resolved"

export interface ReturnGuide {
  stage: ReturnStage
  headline: string
  steps: string[]
  daysLeft: number | null
  canOpenDispute: boolean
}

const DAY = 86_400_000
const ms = (ts?: number) => { const n = Number(ts); return Number.isFinite(n) && n > 0 ? (n < 100_000_000_000 ? n * 1000 : n) : 0 }

export function returnGuideFor(input: {
  status?: string
  paymentStatus?: string
  deliveryStatus?: string
  fulfilmentMethod?: string
  deliveredAt?: number
  completedAt?: number
  updatedAt?: number
  now?: number
}): ReturnGuide {
  const now = input.now ?? Date.now()
  const status = String(input.status || "").toLowerCase()
  const delivery = String(input.deliveryStatus || "").toLowerCase()
  const paid = ["verified", "captured", "held"].includes(String(input.paymentStatus || "").toLowerCase())
  if (["cancelled", "refunded"].includes(status)) {
    return { stage: "resolved", headline: status === "refunded" ? "This order was refunded." : "This order was cancelled.", steps: [], daysLeft: null, canOpenDispute: false }
  }
  if (status === "disputed") {
    return { stage: "resolved", headline: "A dispute is open for this order.", steps: ["Keep all messages inside GreenHaven.", "Add any photos or tracking details the seller or reviewer asks for."], daysLeft: null, canOpenDispute: false }
  }
  if (!paid) {
    return { stage: "not_eligible", headline: "Returns apply after payment is verified.", steps: [], daysLeft: null, canOpenDispute: false }
  }
  const delivered = ["delivered", "service_active", "completed"].includes(delivery) || status === "completed"
  if (!delivered) {
    return {
      stage: "before_delivery",
      headline: "Not delivered yet.",
      steps: ["Check the tracking timeline for the latest update.", "Message the seller if the delivery date has passed.", "If there is no response, open a dispute from this order."],
      daysLeft: null,
      canOpenDispute: true,
    }
  }
  const start = ms(input.deliveredAt) || ms(input.completedAt) || ms(input.updatedAt)
  if (!start) {
    return { stage: "return_window", headline: "Delivered. Report problems promptly.", steps: DELIVERED_STEPS, daysLeft: null, canOpenDispute: true }
  }
  const daysLeft = Math.ceil((start + RETURN_WINDOW_DAYS * DAY - now) / DAY)
  if (daysLeft <= 0) {
    return { stage: "window_closed", headline: `The ${RETURN_WINDOW_DAYS}-day return window has closed.`, steps: ["You can still message the seller about an issue."], daysLeft: 0, canOpenDispute: false }
  }
  return { stage: "return_window", headline: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to report a problem.`, steps: DELIVERED_STEPS, daysLeft, canOpenDispute: true }
}

const DELIVERED_STEPS = [
  "Message the seller with what is wrong and a photo if possible.",
  "Agree on a return, replacement or partial refund inside the chat.",
  "If you cannot agree, open a dispute from this order.",
]
