"use client"

export type WalletV2Categories = {
  rewards: number
  creator: number
  curation: number
  transfersIn: number
  transfersOut: number
  marketplace: number
  membership: number
  withdrawals: number
  adjustments: number
  unclassified: number
}

export type WalletV2Snapshot = {
  userId: string
  currency: "GHC"
  available: number
  pending: number
  locked: number
  escrowLocked: number
  ledgerBalance: number
  lifetimeEarned: number
  lifetimeSpent: number
  lifetimePurchased: number
  pendingCount: number
  categories: WalletV2Categories
  holds: { withdrawalLocked: number; escrowLocked: number; escrowRail: string }
  reconciliation: {
    availablePlusLockedEqualsLedger: boolean
    availableNonNegative: boolean
    pendingNonNegative: boolean
    ledgerNonNegative: boolean
    unclassifiedAmount: number
  }
  updatedAt: number
}

export function emptyWalletV2(userId = ""): WalletV2Snapshot {
  return {
    userId,
    currency: "GHC",
    available: 0,
    pending: 0,
    locked: 0,
    escrowLocked: 0,
    ledgerBalance: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    lifetimePurchased: 0,
    pendingCount: 0,
    categories: {
      rewards: 0, creator: 0, curation: 0, transfersIn: 0, transfersOut: 0,
      marketplace: 0, membership: 0, withdrawals: 0, adjustments: 0, unclassified: 0,
    },
    holds: { withdrawalLocked: 0, escrowLocked: 0, escrowRail: "not_configured" },
    reconciliation: {
      availablePlusLockedEqualsLedger: true,
      availableNonNegative: true,
      pendingNonNegative: true,
      ledgerNonNegative: true,
      unclassifiedAmount: 0,
    },
    updatedAt: Date.now(),
  }
}

export async function fetchWalletV2(options?: { signal?: AbortSignal }): Promise<WalletV2Snapshot> {
  const response = await fetch("/api/economy/wallet/summary", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: options?.signal,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.ok || !payload?.wallet) {
    throw new Error(String(payload?.error || "WALLET_UNAVAILABLE"))
  }
  return payload.wallet as WalletV2Snapshot
}
