/** Pure local mirror of the durable SQL payment-intent transition policy. */
const TERMINAL = new Set(["FULFILLED", "REFUNDED", "FAILED", "CANCELLED"])
const ALLOWED_FROM = Object.freeze({
  CREATED: ["APPROVAL_PENDING", "APPROVED", "COMPLETED", "FAILED", "CANCELLED", "INCOMPLETE"],
  APPROVAL_PENDING: ["APPROVAL_PENDING", "APPROVED", "COMPLETION_PENDING", "COMPLETED", "FAILED", "CANCELLED", "INCOMPLETE"],
  APPROVED: ["APPROVED", "USER_SUBMITTED", "COMPLETION_PENDING", "COMPLETED", "FAILED", "CANCELLED", "INCOMPLETE"],
  USER_SUBMITTED: ["USER_SUBMITTED", "COMPLETION_PENDING", "COMPLETED", "FAILED", "CANCELLED", "INCOMPLETE"],
  COMPLETION_PENDING: ["COMPLETION_PENDING", "COMPLETED", "FAILED", "CANCELLED", "INCOMPLETE"],
  COMPLETED: ["FULFILLED", "REFUNDED"],
  FULFILLED: [],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
  INCOMPLETE: ["APPROVED", "COMPLETION_PENDING", "COMPLETED", "FAILED", "CANCELLED", "INCOMPLETE"],
})

export function isAllowedPaymentTransition(current, next) {
  if (typeof current !== "string" || typeof next !== "string") return false
  if (current === next) return true
  if (TERMINAL.has(current)) return false
  if (current === "COMPLETED" && next !== "FULFILLED" && next !== "REFUNDED") return false
  if (next === "FULFILLED" && current !== "COMPLETED") return false
  if (next === "REFUNDED" && current !== "COMPLETED") return false
  return Boolean(ALLOWED_FROM[current]?.includes(next))
}
