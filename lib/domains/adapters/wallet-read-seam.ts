/**
 * Wallet READ seam — presentation only (Prompt #50.1).
 *
 * Does NOT implement transfer, spend, claim, reward issuance, Pi completion,
 * membership grant, or A2U. Those remain on economy-domain / server APIs.
 *
 * Balance is read from the bound DomainServices economy adapter when present.
 * Never invents balances from localStorage.
 */

import { getBoundDomainServices } from "@/lib/domains/compat"
import type { DomainResult } from "@/lib/domains/contracts/types"

export type WalletReadStatus = "loading" | "ready" | "unavailable" | "error"

export interface WalletReadSnapshot {
  status: WalletReadStatus
  /** Available GHC — only when status === "ready" */
  availableGhc: number | null
  pendingGhc: number | null
  currency: "GHC"
  /** Display-only membership tier if economy exposes it */
  membershipTier: string | null
  /** Opaque message for UI when unavailable/error */
  message?: string
  source: "session" | "empty" | "error"
  updatedAt: number
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  return null
}

/**
 * Read-only snapshot from bound economy services.
 * Never calculates authoritative balance offline from localStorage.
 */
export function readWalletSnapshot(): WalletReadSnapshot {
  const now = Date.now()
  try {
    const services = getBoundDomainServices()
    const economy = services?.economy as
      | {
          getWallet?: () => {
            balance?: number
            available?: number
            pending?: number
            pendingBalance?: number
          }
          getPremiumStatus?: () => { tier?: string; plan?: string } | null
        }
      | undefined

    if (!economy || typeof economy.getWallet !== "function") {
      return {
        status: "unavailable",
        availableGhc: null,
        pendingGhc: null,
        currency: "GHC",
        membershipTier: null,
        message: "Wallet services are not bound yet.",
        source: "empty",
        updatedAt: now,
      }
    }

    const w = economy.getWallet()
    const available = numOrNull(w?.balance) ?? numOrNull(w?.available)
    const pending = numOrNull(w?.pending) ?? numOrNull(w?.pendingBalance) ?? 0

    if (available === null) {
      return {
        status: "unavailable",
        availableGhc: null,
        pendingGhc: null,
        currency: "GHC",
        membershipTier: null,
        message: "Balance unavailable from authoritative wallet.",
        source: "empty",
        updatedAt: now,
      }
    }

    let membershipTier: string | null = null
    try {
      if (typeof economy.getPremiumStatus === "function") {
        const p = economy.getPremiumStatus()
        membershipTier = p?.tier || p?.plan || null
      }
    } catch {
      membershipTier = null
    }

    return {
      status: "ready",
      availableGhc: available,
      pendingGhc: pending,
      currency: "GHC",
      membershipTier,
      source: "session",
      updatedAt: now,
    }
  } catch (e) {
    return {
      status: "error",
      availableGhc: null,
      pendingGhc: null,
      currency: "GHC",
      membershipTier: null,
      message: e instanceof Error ? e.message : "Wallet read failed",
      source: "error",
      updatedAt: now,
    }
  }
}

export function walletReadResult(): DomainResult<WalletReadSnapshot> {
  const snap = readWalletSnapshot()
  if (snap.status === "error") {
    return { ok: false, error: snap.message || "WALLET_READ_ERROR", code: "WALLET_READ_ERROR" }
  }
  if (snap.status === "unavailable") {
    return { ok: true, data: snap, source: "empty" }
  }
  return { ok: true, data: snap, source: "session" }
}

/** Guard: this module must never export mutation helpers named transfer/spend/claim */
export const WALLET_READ_SEAM_MUTATIONS = Object.freeze({
  transfer: false,
  spend: false,
  claim: false,
  reward: false,
  piComplete: false,
  membershipGrant: false,
})
