import type { GhcTransaction } from "@/lib/domains/economy-types"

export type GhcStatementSummary = {
  incoming: number
  outgoing: number
  pending: number
  settledCount: number
}

/**
 * Summarise only the rows currently loaded for the GHC statement.
 * Pending records are deliberately kept separate from settled movement;
 * failed, cancelled and reversed rows never inflate statement totals.
 * This is presentation-only and never changes ledger authority.
 */
export function summarizeGhcStatement(rows: readonly GhcTransaction[]): GhcStatementSummary {
  let incoming = 0
  let outgoing = 0
  let pending = 0
  let settledCount = 0

  for (const row of rows) {
    if (!Number.isFinite(row.amount) || !Number.isFinite(row.createdAt)) continue
    const status = String(row.status || "posted").toLowerCase()
    if (["failed", "reversed", "cancelled", "canceled", "expired"].includes(status)) continue
    if (status === "pending" || row.kind === "pending") {
      pending += Math.abs(row.amount)
      continue
    }
    settledCount += 1
    if (row.amount > 0) incoming += row.amount
    else if (row.amount < 0) outgoing += Math.abs(row.amount)
  }

  return { incoming, outgoing, pending, settledCount }
}


export type GhcMonthlyMovement = {
  incoming: number
  outgoing: number
  pending: number
  settledCount: number
  pendingCount: number
  loadedCount: number
}

/**
 * Month-to-date GHC movement from the locally hydrated ledger rows only.
 * Pending is reported separately; failed/reversed/cancelled/expired entries
 * never inflate settled trends. No Pi payment intents are accepted here.
 */
export function summarizeGhcMonthlyMovement(
  rows: readonly GhcTransaction[],
  now = Date.now(),
): GhcMonthlyMovement {
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const start = monthStart.getTime()
  let incoming = 0
  let outgoing = 0
  let pending = 0
  let settledCount = 0
  let pendingCount = 0
  let loadedCount = 0

  for (const row of rows) {
    if (!Number.isFinite(row.amount) || !Number.isFinite(row.createdAt) || row.createdAt < start || row.createdAt > now) continue
    loadedCount += 1
    const status = String(row.status || "posted").toLowerCase()
    if (["failed", "reversed", "cancelled", "canceled", "expired"].includes(status)) continue
    if (status === "pending" || row.kind === "pending") {
      pending += Math.abs(row.amount)
      pendingCount += 1
      continue
    }
    // A transfer request is a request record, not a completed money movement.
    if (row.kind === "transfer_request") continue
    if (status !== "posted") continue
    settledCount += 1
    if (row.amount > 0) incoming += row.amount
    else if (row.amount < 0) outgoing += Math.abs(row.amount)
  }

  return { incoming, outgoing, pending, settledCount, pendingCount, loadedCount }
}
