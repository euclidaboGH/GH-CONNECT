"use client"

/**
 * Phase 2A — Wallet domain boundary.
 * READ + navigation only. No client-side balance invention or settlement.
 * Mutations: POST /api/economy/* only; UI reflects server snapshots.
 */

import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { WalletReadProvider, useWalletRead } from "./wallet-read-provider"

export type WalletAssetRail = "ghc" | "pi"

type WalletDomainValue = {
  assetRail: WalletAssetRail
  setAssetRail: (rail: WalletAssetRail) => void
  /** Display snapshot from WalletReadProvider — server-sourced when available */
  availableGhc: number
  pendingGhc: number
  lockedGhc: number
  refreshWallet: () => void
  canMutateFinances: false
}

const WalletDomainContext = createContext<WalletDomainValue | null>(null)

function WalletDomainInner({ children }: { children: ReactNode }) {
  const read = useWalletRead()
  const [assetRail, setAssetRail] = useState<WalletAssetRail>("ghc")
  const value = useMemo<WalletDomainValue>(
    () => ({
      assetRail,
      setAssetRail,
      availableGhc: read.snapshot.availableGhc ?? 0,
      pendingGhc: read.snapshot.pendingGhc ?? 0,
      lockedGhc: read.snapshot.lockedGhc ?? 0,
      refreshWallet: read.refresh,
      canMutateFinances: false,
    }),
    [assetRail, read],
  )
  return <WalletDomainContext.Provider value={value}>{children}</WalletDomainContext.Provider>
}

export function WalletDomainProvider({ children }: { children: ReactNode }) {
  return (
    <WalletReadProvider>
      <WalletDomainInner>{children}</WalletDomainInner>
    </WalletReadProvider>
  )
}

export function useWalletDomain(): WalletDomainValue {
  const ctx = useContext(WalletDomainContext)
  if (!ctx) {
    // Fail soft for trees outside provider — never invent balances as authority
    return {
      assetRail: "ghc",
      setAssetRail: () => {},
      availableGhc: 0,
      pendingGhc: 0,
      lockedGhc: 0,
      refreshWallet: () => {},
      canMutateFinances: false,
    }
  }
  return ctx
}
