/** Marketplace order presentation helpers. Transitions remain server-authoritative. */
export function orderStatusLabel(status: unknown): string {
  const s = String(status || "").toLowerCase()
  const map: Record<string, string> = {
    draft: "Draft",
    pending_payment: "Awaiting payment",
    paid: "Paid",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    refunded: "Refunded",
    disputed: "Disputed",
    failed: "Failed",
  }
  return map[s] || (s ? s.replace(/_/g, " ") : "Unknown status")
}

export function isTerminalOrderStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase()
  return ["completed", "cancelled", "canceled", "refunded", "failed"].includes(s)
}

export function orderNeedsBuyerAction(status: unknown): boolean {
  const s = String(status || "").toLowerCase()
  return ["pending_payment", "draft"].includes(s)
}

export function orderNeedsSellerAction(status: unknown): boolean {
  const s = String(status || "").toLowerCase()
  return ["paid", "processing"].includes(s)
}

export function safeOrderQuantity(value: unknown, max = 99): number {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 1) return 1
  return Math.min(n, Math.max(1, max))
}
