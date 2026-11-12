import type { Notification } from "./notifications"

export type NotificationPriorityBand = "critical" | "high" | "normal" | "low"

export type NotificationPriorityAssessment = {
  band: NotificationPriorityBand
  score: number
  requiresAttention: boolean
  reason: string
}

const CRITICAL = /security alert|password changed|account suspended|account restricted|unauthori[sz]ed|payment failed|transfer failed|verification required/i
const ACTIONABLE = /action required|awaiting your|needs your|pending approval|order needs|request to join|connection request|claim available|renewal due|delivery issue/i

/** Deterministic, explainable ranking. Never treats notification metadata as financial truth. */
export function assessNotificationPriority(n: Pick<Notification, "type" | "title" | "message" | "timestamp" | "data" | "read">): NotificationPriorityAssessment {
  const text = `${n.title || ""} ${n.message || ""}`
  const type = String(n.type || "")
  const category = String(n.data?.category || n.data?.bucket || "").toLowerCase()
  const ageHours = Math.max(0, (Date.now() - (Number(n.timestamp) || Date.now())) / 3_600_000)

  if (CRITICAL.test(text) && ["system", "payment", "ghc_received", "ghc_sent"].includes(type)) {
    return { band: "critical", score: 100, requiresAttention: !n.read, reason: "Security or failed transaction notice" }
  }
  if (ACTIONABLE.test(text) || ["message", "friend_request", "connection_request", "marketplace_order", "payment"].includes(type) || category === "requests") {
    const score = Math.max(72, 92 - Math.min(ageHours, 48) * 0.35)
    return { band: "high", score, requiresAttention: !n.read, reason: "A response or review may be needed" }
  }
  if (["ghc_received", "ghc_sent", "reward", "mention", "comment_reply", "group"].includes(type) || ["wallet", "rewards", "community"].includes(category)) {
    const score = Math.max(42, 68 - Math.min(ageHours, 72) * 0.25)
    return { band: "normal", score, requiresAttention: !n.read, reason: "Relevant account or community update" }
  }
  if (["system", "marketplace_listing"].includes(type)) {
    return { band: "normal", score: 50, requiresAttention: !n.read, reason: "Service or marketplace update" }
  }
  const score = Math.max(5, 35 - Math.min(ageHours, 168) * 0.15)
  return { band: "low", score, requiresAttention: false, reason: "Social activity update" }
}

export function sortNotificationsByPriority<T extends Pick<Notification, "type" | "title" | "message" | "timestamp" | "data" | "read">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const score = assessNotificationPriority(b).score - assessNotificationPriority(a).score
    if (score) return score
    return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)
  })
}

export function isPriorityNotification(n: Pick<Notification, "type" | "title" | "message" | "timestamp" | "data" | "read">): boolean {
  const assessment = assessNotificationPriority(n)
  return !n.read && (assessment.band === "critical" || assessment.band === "high")
}
