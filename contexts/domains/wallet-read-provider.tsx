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
  useState,
  type ReactNode,
} from "react"
import {
  readWalletSnapshot,
  type WalletReadSnapshot,
  WALLET_READ_SEAM_MUTATIONS,
} from "@/lib/domains/adapters/wallet-read-seam"
import { domainEvents } from "@/lib/realtime/event-bus"

export interface WalletReadProviderValue {
  snapshot: WalletReadSnapshot
  refresh: () => void
  /** Explicit: this provider cannot mutate finances */
  canMutateFinances: false
  mutationsAllowed: typeof WALLET_READ_SEAM_MUTATIONS
}

const WalletReadContext = createContext<WalletReadProviderValue | null>(null)

export function WalletReadProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WalletReadSnapshot>(() => readWalletSnapshot())

  const refresh = useCallback(() => {
    setSnapshot(readWalletSnapshot())
  }, [])

  useEffect(() => {
    refresh()
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
        refresh()
      })
    )
    const id = setInterval(refresh, 30000)
    return () => {
      unsubs.forEach((u) => u())
      clearInterval(id)
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
    return {
      snapshot: readWalletSnapshot(),
      refresh: () => {},
      canMutateFinances: false,
      mutationsAllowed: WALLET_READ_SEAM_MUTATIONS,
    }
  }
  return ctx
}
