import type { Notification } from "./notifications"
import { assessNotificationPriority } from "./notification-priority.ts"

export type AttentionKind = "messages" | "requests" | "community" | "marketplace" | "wallet" | "rewards" | "system"

export type AttentionSignal = {
  kind: AttentionKind
  count: number
  label: string
  detail: string
  priority: number
  open: "messages" | "matches" | "communities" | "marketplace" | "wallet" | "rewards" | "settings"
}

export function buildAttentionSignals(items: Notification[]): AttentionSignal[] {
  const unread = items.filter((item) => !item.read)
  const category = (item: Notification) => String(item.data?.category || "").toLowerCase()
  const openTarget = (item: Notification) => String(item.data?.open || item.data?.target || "").toLowerCase()
  const matching = (predicate: (item: Notification) => boolean) => unread.filter(predicate)
  const signal = (kind: AttentionKind, label: string, detail: string, open: AttentionSignal["open"], predicate: (item: Notification) => boolean): AttentionSignal | null => {
    const rows = matching(predicate)
    if (!rows.length) return null
    const priority = Math.max(...rows.map((item) => assessNotificationPriority(item).score))
    return { kind, count: rows.length, label, detail, priority, open }
  }
  return [
    signal("messages", "Messages", "Conversations waiting for you", "messages", (n) => n.type === "message" || (n.type === "group" && category(n) !== "community" && openTarget(n) !== "community")),
    signal("requests", "Requests", "People waiting for a response", "matches", (n) => n.type === "friend_request" || n.type === "connection_request" || openTarget(n) === "requests"),
    signal("marketplace", "Marketplace", "Orders or commerce activity", "marketplace", (n) => n.type === "marketplace_order" || category(n) === "marketplace"),
    signal("wallet", "Wallet", "Financial activity to review", "wallet", (n) => n.type === "payment" || n.type === "ghc_received" || n.type === "ghc_sent" || category(n) === "wallet" || openTarget(n) === "wallet" || openTarget(n) === "transaction"),
    signal("community", "Communities", "Community activity that may need you", "communities", (n) => category(n) === "community" || (n.type === "group" && openTarget(n) === "community")),
    signal("rewards", "Rewards", "Participation opportunities and updates", "rewards", (n) => n.type === "reward"),
    signal("system", "Account", "Security or account notices", "settings", (n) => n.type === "system" && (category(n) === "system" || ["settings", "security", "verification"].includes(openTarget(n)) || assessNotificationPriority(n).band === "critical")),
  ].filter((item): item is AttentionSignal => Boolean(item)).sort((a, b) => b.priority - a.priority)
}

export function resolvePrimaryAttention(signals: AttentionSignal[]): AttentionSignal | null {
  return signals[0] || null
}
