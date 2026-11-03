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

function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/** Validate the untrusted HTTP payload before it enters wallet presentation state. */
export function normalizeWalletV2Snapshot(value: unknown): WalletV2Snapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("WALLET_INVALID_SNAPSHOT")
  const raw = value as Record<string, unknown>
  if (raw.currency !== "GHC") throw new Error("WALLET_INVALID_CURRENCY")
  const required = ["available", "pending", "locked", "escrowLocked", "ledgerBalance", "lifetimeEarned", "lifetimeSpent", "lifetimePurchased", "pendingCount"] as const
  const amounts: Record<string, number> = {}
  for (const key of required) {
    const parsed = finiteNonNegative(raw[key])
    if (parsed === null) throw new Error(`WALLET_INVALID_${key.toUpperCase()}`)
    amounts[key] = parsed
  }
  const updatedAt = finiteNonNegative(raw.updatedAt)
  if (updatedAt === null || updatedAt <= 0 || updatedAt > Date.now() + 5 * 60_000) throw new Error("WALLET_INVALID_UPDATED_AT")
  // A server-authoritative snapshot must identify the account it describes.
  // Empty/missing IDs make account-switch and stale-response bugs harder to detect.
  if (typeof raw.userId !== "string" || !raw.userId.trim() || raw.userId.trim().length > 160) {
    throw new Error("WALLET_INVALID_USER_ID")
  }
  if (!Number.isSafeInteger(amounts.pendingCount)) throw new Error("WALLET_INVALID_PENDING_COUNT")
  const rawCategories = raw.categories
  if (!rawCategories || typeof rawCategories !== "object" || Array.isArray(rawCategories)) throw new Error("WALLET_INVALID_CATEGORIES")
  const categoryKeys: Array<keyof WalletV2Categories> = ["rewards", "creator", "curation", "transfersIn", "transfersOut", "marketplace", "membership", "withdrawals", "adjustments", "unclassified"]
  const categories = {} as WalletV2Categories
  for (const key of categoryKeys) {
    const parsed = finiteNonNegative((rawCategories as Record<string, unknown>)[key])
    if (parsed === null) throw new Error(`WALLET_INVALID_CATEGORY_${key.toUpperCase()}`)
    categories[key] = parsed
  }
  const holdsRaw = raw.holds
  if (!holdsRaw || typeof holdsRaw !== "object" || Array.isArray(holdsRaw)) throw new Error("WALLET_INVALID_HOLDS")
  const holdsRecord = holdsRaw as Record<string, unknown>
  const withdrawalLocked = finiteNonNegative(holdsRecord.withdrawalLocked)
  const holdsEscrowLocked = finiteNonNegative(holdsRecord.escrowLocked)
  const supportedEscrowRails = new Set(["not_configured", "ghc_ledger", "pi_escrow"])
  if (withdrawalLocked === null || holdsEscrowLocked === null || typeof holdsRecord.escrowRail !== "string" || !supportedEscrowRails.has(holdsRecord.escrowRail)) throw new Error("WALLET_INVALID_HOLDS")
  const reconciliationRaw = raw.reconciliation
  if (!reconciliationRaw || typeof reconciliationRaw !== "object" || Array.isArray(reconciliationRaw)) throw new Error("WALLET_INVALID_RECONCILIATION")
  const rec = reconciliationRaw as Record<string, unknown>
  const boolKeys = ["availablePlusLockedEqualsLedger", "availableNonNegative", "pendingNonNegative", "ledgerNonNegative"] as const
  for (const key of boolKeys) if (typeof rec[key] !== "boolean") throw new Error("WALLET_INVALID_RECONCILIATION")
  const unclassifiedAmount = finiteNonNegative(rec.unclassifiedAmount)
  if (unclassifiedAmount === null) throw new Error("WALLET_INVALID_RECONCILIATION")
  return {
    userId: raw.userId.trim(),
    currency: "GHC",
    available: amounts.available,
    pending: amounts.pending,
    locked: amounts.locked,
    escrowLocked: amounts.escrowLocked,
    ledgerBalance: amounts.ledgerBalance,
    lifetimeEarned: amounts.lifetimeEarned,
    lifetimeSpent: amounts.lifetimeSpent,
    lifetimePurchased: amounts.lifetimePurchased,
    pendingCount: Math.trunc(amounts.pendingCount),
    categories,
    holds: { withdrawalLocked, escrowLocked: holdsEscrowLocked, escrowRail: holdsRecord.escrowRail as string },
    reconciliation: {
      availablePlusLockedEqualsLedger: rec.availablePlusLockedEqualsLedger as boolean,
      availableNonNegative: rec.availableNonNegative as boolean,
      pendingNonNegative: rec.pendingNonNegative as boolean,
      ledgerNonNegative: rec.ledgerNonNegative as boolean,
      unclassifiedAmount,
    },
    updatedAt,
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
  return normalizeWalletV2Snapshot(payload.wallet)
}
