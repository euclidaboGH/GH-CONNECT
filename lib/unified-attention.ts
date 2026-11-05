export type AttentionKind = "messages" | "requests" | "community" | "marketplace" | "wallet" | "rewards" | "system"

export type AttentionSignal = {
  kind: AttentionKind
  count: number
  label: string
  detail: string
  priority: number
  open: "messages" | "matches" | "communities" | "marketplace" | "wallet" | "rewards" | "settings"
}

const PRIORITY: Record<AttentionKind, number> = {
  messages: 100,
  requests: 95,
  marketplace: 90,
  wallet: 85,
  community: 75,
  rewards: 60,
  system: 50,
}

export function buildAttentionSignals(items: Array<{ read?: boolean; type?: string; data?: Record<string, unknown> }>): AttentionSignal[] {
  const unread = items.filter((item) => !item.read)
  const category = (item: (typeof unread)[number]) => String(item.data?.category || "").toLowerCase()
  const openTarget = (item: (typeof unread)[number]) => String(item.data?.open || item.data?.target || "").toLowerCase()
  const count = (predicate: (item: (typeof unread)[number]) => boolean) => unread.filter(predicate).length
  const signals: AttentionSignal[] = [
    { kind: "messages", count: count((n) => n.type === "message" || (n.type === "group" && category(n) !== "community" && openTarget(n) !== "community")), label: "Messages", detail: "Conversations waiting for you", priority: PRIORITY.messages, open: "messages" },
    { kind: "requests", count: count((n) => n.type === "friend_request" || String(n.data?.open || "") === "requests"), label: "Requests", detail: "People waiting for a response", priority: PRIORITY.requests, open: "matches" },
    { kind: "marketplace", count: count((n) => n.type === "marketplace_order" || String(n.data?.category || "") === "marketplace"), label: "Marketplace", detail: "Orders or commerce activity", priority: PRIORITY.marketplace, open: "marketplace" },
    { kind: "wallet", count: count((n) => n.type === "payment" || n.type === "ghc_received" || n.type === "ghc_sent"), label: "Wallet", detail: "Financial activity to review", priority: PRIORITY.wallet, open: "wallet" },
    { kind: "community", count: count((n) => category(n) === "community" || (n.type === "group" && openTarget(n) === "community")), label: "Communities", detail: "Community activity that may need you", priority: PRIORITY.community, open: "communities" },
    { kind: "rewards", count: count((n) => n.type === "reward"), label: "Rewards", detail: "Participation opportunities and updates", priority: PRIORITY.rewards, open: "rewards" },
    { kind: "system", count: count((n) => n.type === "system"), label: "Account", detail: "Security or account notices", priority: PRIORITY.system, open: "settings" },
  ]
  return signals.filter((signal) => signal.count > 0).sort((a, b) => b.priority - a.priority)
}

export function resolvePrimaryAttention(signals: AttentionSignal[]): AttentionSignal | null {
  return signals[0] || null
}
