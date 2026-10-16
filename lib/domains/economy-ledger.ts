/**
 * GHC Ledger — transaction-based accounting.
 * Balance never changes without a recorded transaction (reason + sourceEvent).
 * Server is authoritative when HTTP economy repo is configured; local cache otherwise.
 */

import type {
  GhcTransaction,
  GhcTransactionKind,
  GhcTransactionStatus,
  GhcWalletSnapshot,
  EconomyLimits,
} from "./economy-types"
import { DEFAULT_ECONOMY_LIMITS } from "./economy-types"

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function emptyWallet(userId: string): GhcWalletSnapshot {
  return {
    userId,
    balance: 0,
    pending: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    lifetimePurchased: 0,
    updatedAt: Date.now(),
  }
}

/** Recompute wallet from posted + pending transactions (source of truth for local mode) */
export function computeWalletFromLedger(
  userId: string,
  txs: GhcTransaction[],
  limits: EconomyLimits = DEFAULT_ECONOMY_LIMITS
): GhcWalletSnapshot {
  let balance = 0
  let pending = 0
  let lifetimeEarned = 0
  let lifetimeSpent = 0
  let lifetimePurchased = 0

  for (const tx of txs) {
    if (tx.userId !== userId) continue
    // Lifecycle markers only — never affect available or pending GHC
    if (tx.kind === "transfer_request") continue
    if (tx.status === "pending") {
      if (tx.amount > 0) pending += tx.amount
      continue
    }
    if (tx.status === "reversed" || tx.status === "expired" || tx.status === "failed") continue
    if (tx.status !== "posted") continue

    balance += tx.amount
    if ((tx.kind === "earned" || tx.kind === "transfer_in") && tx.amount > 0) lifetimeEarned += tx.amount
    if ((tx.kind === "spent" || tx.kind === "transfer_out") && tx.amount < 0) lifetimeSpent += Math.abs(tx.amount)
    if (tx.kind === "purchased" && tx.amount > 0) lifetimePurchased += tx.amount
  }

  if (balance < limits.minBalance) {
    // Accounting invariant: do not surface negative under current rules
    balance = limits.minBalance
  }

  return {
    userId,
    balance,
    pending,
    lifetimeEarned,
    lifetimeSpent,
    lifetimePurchased,
    updatedAt: Date.now(),
  }
}

export interface LedgerWriteInput {
  userId: string
  kind: GhcTransactionKind
  amount: number
  reason: string
  sourceEvent: string
  referenceId?: string
  metadata?: Record<string, unknown>
  status?: GhcTransactionStatus
  expiresAt?: number
  adjustedBy?: string
}

export function createLedgerTransaction(
  input: LedgerWriteInput,
  limits: EconomyLimits = DEFAULT_ECONOMY_LIMITS
): { ok: true; tx: GhcTransaction } | { ok: false; error: string } {
  if (!input.reason?.trim()) return { ok: false, error: "Transaction reason required" }
  if (!input.sourceEvent?.trim()) return { ok: false, error: "Source event required" }
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    return { ok: false, error: "Amount must be a non-zero number" }
  }

  const status: GhcTransactionStatus =
    input.status || (input.kind === "pending" ? "pending" : "posted")

  // Debits must not drive balance below min when posting immediately
  // (caller should pass current balance for spend checks)

  const tx: GhcTransaction = {
    id: genId("ghctx"),
    userId: input.userId,
    kind: input.kind,
    status,
    amount: input.amount,
    reason: input.reason.trim(),
    sourceEvent: input.sourceEvent.trim(),
    referenceId: input.referenceId,
    metadata: input.metadata,
    createdAt: Date.now(),
    postedAt: status === "posted" ? Date.now() : undefined,
    expiresAt: input.expiresAt,
    adjustedBy: input.adjustedBy,
  }
  return { ok: true, tx }
}

export function canPostDebit(
  wallet: GhcWalletSnapshot,
  debitAmount: number,
  limits: EconomyLimits = DEFAULT_ECONOMY_LIMITS
): boolean {
  // debitAmount should be negative for spend; accept absolute
  const need = Math.abs(debitAmount)
  return wallet.balance - need >= limits.minBalance
}

export function reverseTransaction(
  original: GhcTransaction,
  reason: string,
  actorId: string
): GhcTransaction {
  return {
    id: genId("ghctx"),
    userId: original.userId,
    kind: "reversed",
    status: "posted",
    amount: -original.amount,
    reason: reason || `Reversal of ${original.id}`,
    sourceEvent: "ledger.reverse",
    referenceId: original.id,
    metadata: { reversedTxId: original.id },
    createdAt: Date.now(),
    postedAt: Date.now(),
    adjustedBy: actorId,
  }
}
