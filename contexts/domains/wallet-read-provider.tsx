"use client"

/**
 * Wallet READ provider (Prompt #50.1).
 * Display-only GHC snapshot. NO transfer/spend/claim/Pi/membership mutations.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  readWalletSnapshot,
  type WalletReadSnapshot,
  WALLET_READ_SEAM_MUTATIONS,
} from "@/lib/domains/adapters/wallet-read-seam"
import { domainEvents } from "@/lib/realtime/event-bus"
import { fetchWalletV2, emptyWalletV2 } from "@/lib/domains/wallet-v2"

export interface WalletReadProviderValue {
  snapshot: WalletReadSnapshot
  refresh: () => Promise<boolean>
  /** Explicit: this provider cannot mutate finances */
  canMutateFinances: false
  mutationsAllowed: typeof WALLET_READ_SEAM_MUTATIONS
}

const WalletReadContext = createContext<WalletReadProviderValue | null>(null)

export function WalletReadProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WalletReadSnapshot>(() => {
    const local = readWalletSnapshot()
    const empty = emptyWalletV2()
    return { ...local, categories: empty.categories, ledgerBalance: null, escrowLocked: 0, reconciliation: empty.reconciliation }
  })
  const requestSequence = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const refresh = useCallback(async (): Promise<boolean> => {
    const sequence = ++requestSequence.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    const local = readWalletSnapshot()
    try {
      const wallet = await fetchWalletV2({ signal: controller.signal })
      if (sequence !== requestSequence.current) return false
      setSnapshot({
        status: "ready",
        availableGhc: wallet.available,
        pendingGhc: wallet.pending,
        lockedGhc: wallet.locked,
        currency: "GHC",
        membershipTier: local.membershipTier,
        source: "server",
        updatedAt: wallet.updatedAt,
        categories: wallet.categories,
        ledgerBalance: wallet.ledgerBalance,
        escrowLocked: wallet.escrowLocked,
        reconciliation: wallet.reconciliation,
      })
      return true
    } catch {
      if (sequence !== requestSequence.current) return false
      setSnapshot((previous) => {
        // Preserve the last server-confirmed values on transient failure, but
        // mark them stale. Never replace a known server snapshot with local cache.
        if (previous.source === "server") {
          return { ...previous, status: "error", message: "Wallet refresh failed; showing the last server-confirmed snapshot." }
        }
        return {
          ...local,
          status: "error",
          message: "Authoritative wallet is unavailable; displayed values are not freshly server-confirmed.",
          categories: emptyWalletV2().categories,
          ledgerBalance: null,
          escrowLocked: 0,
          reconciliation: emptyWalletV2().reconciliation,
        }
      })
      return false
    } finally {
      window.clearTimeout(timeout)
      if (sequence === requestSequence.current) activeRequest.current = null
    }
  }, [])

  useEffect(() => {
    void refresh()
    const types = [
      "WALLET_BALANCE_UPDATED",
      "WALLET_TRANSFER_COMPLETED",
      "REWARD_EARNED",
      "REWARD_REDEEMED",
      "PREMIUM_ACTIVATED",
      "PREMIUM_EXPIRED",
      "PAYMENT_COMPLETED",
    ] as const
    const unsubs = types.map((type) =>
      domainEvents.on(type, () => {
        void refresh()
      })
    )
    const onClaimed = () => {
      // Claim path already hydrates; refresh display from repo after event
      refresh()
    }
    const onSynced = () => {
      refresh()
    }
    try {
      window.addEventListener("ghc:daily-reward-claimed", onClaimed)
      window.addEventListener("ghc:wallet-synced", onSynced)
      window.addEventListener("ghc:wallet-refresh", onSynced)
      window.addEventListener("ghc:marketplace-order-changed", onSynced)
      window.addEventListener("ghc:ghc-pack-intent", onSynced)
      window.addEventListener("ghc:utility-spent", onSynced)
      window.addEventListener("ghc:referral-settled", onSynced)
    } catch {
      /* */
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh()
    }
    const onOnline = () => { if (document.visibilityState === "visible") void refresh() }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", onOnline)
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh()
    }, 30000)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", onOnline)
      requestSequence.current += 1
      activeRequest.current?.abort()
      activeRequest.current = null
      unsubs.forEach((u) => u())
      clearInterval(id)
      try {
        window.removeEventListener("ghc:daily-reward-claimed", onClaimed)
        window.removeEventListener("ghc:wallet-synced", onSynced)
        window.removeEventListener("ghc:wallet-refresh", onSynced)
        window.removeEventListener("ghc:marketplace-order-changed", onSynced)
        window.removeEventListener("ghc:ghc-pack-intent", onSynced)
        window.removeEventListener("ghc:utility-spent", onSynced)
        window.removeEventListener("ghc:referral-settled", onSynced)
      } catch {
        /* */
      }
    }
  }, [refresh])

  const value = useMemo<WalletReadProviderValue>(
    () => ({
      snapshot,
      refresh,
      canMutateFinances: false,
      mutationsAllowed: WALLET_READ_SEAM_MUTATIONS,
    }),
    [snapshot, refresh]
  )

  return (
    <WalletReadContext.Provider value={value}>{children}</WalletReadContext.Provider>
  )
}

export function useWalletRead(): WalletReadProviderValue {
  const ctx = useContext(WalletReadContext)
  if (!ctx) {
    const local = readWalletSnapshot()
    const empty = emptyWalletV2()
    return {
      snapshot: { ...local, categories: empty.categories, ledgerBalance: null, escrowLocked: 0, reconciliation: empty.reconciliation },
      refresh: async () => false,
      canMutateFinances: false,
      mutationsAllowed: WALLET_READ_SEAM_MUTATIONS,
    }
  }
  return ctx
}
