/**
 * Server + client order memory (process / localStorage).
 * Production: replace with DB table `gh_pay_orders`.
 */
import type { GhPayOrder, OrderStatus } from "./types"

const CLIENT_KEY = "gh_pay_orders_v1"
const globalStore = globalThis as unknown as {
  __ghPayOrders?: Map<string, GhPayOrder>
}

function serverMap(): Map<string, GhPayOrder> {
  if (!globalStore.__ghPayOrders) globalStore.__ghPayOrders = new Map()
  return globalStore.__ghPayOrders
}

export function saveOrder(order: GhPayOrder): void {
  if (typeof window === "undefined") {
    serverMap().set(order.orderId, order)
    return
  }
  try {
    const raw = localStorage.getItem(CLIENT_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, GhPayOrder>) : {}
    all[order.orderId] = order
    localStorage.setItem(CLIENT_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

export function getOrder(orderId: string): GhPayOrder | null {
  if (typeof window === "undefined") {
    return serverMap().get(orderId) || null
  }
  try {
    const raw = localStorage.getItem(CLIENT_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, GhPayOrder>
    return all[orderId] || null
  } catch {
    return null
  }
}

export function listOrdersForUser(userId: string): GhPayOrder[] {
  if (typeof window === "undefined") {
    return [...serverMap().values()]
      .filter((o) => o.userId === userId || o.recipientUid === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }
  try {
    const raw = localStorage.getItem(CLIENT_KEY)
    if (!raw) return []
    const all = JSON.parse(raw) as Record<string, GhPayOrder>
    return Object.values(all)
      .filter((o) => o.userId === userId || o.recipientUid === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  patch?: Partial<GhPayOrder>
): GhPayOrder | null {
  const prev = getOrder(orderId)
  if (!prev) return null
  const next: GhPayOrder = {
    ...prev,
    ...patch,
    status,
    updatedAt: Date.now(),
    fulfilledAt: status === "fulfilled" ? Date.now() : prev.fulfilledAt,
  }
  saveOrder(next)
  return next
}

export function genOrderId(): string {
  return `gho_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}
