import type { GhcTransaction } from "@/lib/domains/economy-types"

export type WalletTab = "activity" | "rewards" | "about"
export type TxFilter = "all" | "earned" | "spent" | "pending" | "sent" | "received"

export type PendingHold = {
  id: string
  amount: number
  reason: string
  source: "achievement" | "challenge" | "validation" | "reward" | "other"
  expectedClearLabel: string
  createdAt: number
  claimState: "ready" | "review"
  stackCount?: number
  stackIds?: string[]
}

export type { GhcTransaction }

export const TX_LABELS: Record<string, string> = {
  earned: "Activity credit",
  spent: "Spent",
  purchased: "Purchased",
  pending: "Pending",
  reversed: "Reversed",
  expired: "Expired",
  adjusted: "Adjusted",
  transfer_out: "Sent",
  transfer_in: "Received",
  transfer_request: "Request",
}
