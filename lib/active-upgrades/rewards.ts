/** Rewards progress UX; claim eligibility and reward amounts are always server-derived. */
export function rewardProgressPercent(current: unknown, target: unknown): number {
  const c = Number(current)
  const t = Number(target)
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)))
}

export function rewardClaimState(
  value: unknown,
): "available" | "claimed" | "pending" | "locked" | "unknown" {
  const s = String(value ?? "").toLowerCase()
  if (["available", "eligible", "claimable"].includes(s)) return "available"
  if (["claimed", "completed", "paid"].includes(s)) return "claimed"
  if (["pending", "processing", "pending_validation"].includes(s)) return "pending"
  if (["locked", "ineligible", "blocked", "rejected"].includes(s)) return "locked"
  return "unknown"
}

export function rewardStreakLabel(days: unknown): string {
  const n = Number(days)
  return Number.isSafeInteger(n) && n > 0 ? `${Math.min(n, 9999)}-day streak` : "Start your streak"
}

export function normalizeRewardHistoryPage(value: unknown): number {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 1) return 1
  return Math.min(n, 500)
}

export function canShowClaimCta(state: ReturnType<typeof rewardClaimState>): boolean {
  return state === "available"
}

export function humanizeRewardClaimError(code?: string): string {
  const c = String(code || "").toUpperCase()
  if (c.includes("INSUFFICIENT") || c.includes("NOT_READY")) return "This reward is not ready to claim yet."
  if (c.includes("ALREADY") || c.includes("CLAIMED")) return "Already claimed."
  if (c.includes("AUTH")) return "Sign in to claim rewards."
  if (c.includes("RATE")) return "Too many claim attempts. Wait a moment and try again."
  if (c.includes("NETWORK")) return "Could not reach rewards service. Check your connection."
  return "Could not claim reward. Try again shortly."
}
