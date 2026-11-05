"use client"

/**
 * Connections READ seam (Step 4).
 * Presentation over graph counts — mutations stay on GHC / unified connection adapter.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import {
  createConnectionsSeam,
} from "@/lib/domains/adapters/ghc-context-seams"
import type { ConnectionsSummary } from "@/lib/domains/contracts/connections"
import type { DomainResult } from "@/lib/domains/contracts/types"

export interface ConnectionsProviderValue {
  getSummary: () => DomainResult<ConnectionsSummary>
  bindCountsGetter: (getter: () => Partial<ConnectionsSummary>) => void
}

const ConnectionsContext = createContext<ConnectionsProviderValue | null>(null)

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const getterRef = useRef<() => Partial<ConnectionsSummary>>(() => ({}))

  const bindCountsGetter = useCallback((getter: () => Partial<ConnectionsSummary>) => {
    getterRef.current = getter
  }, [])

  const value = useMemo<ConnectionsProviderValue>(() => {
    const seam = createConnectionsSeam(() => getterRef.current())
    return {
      getSummary: () => seam.getSummary(),
      bindCountsGetter,
    }
  }, [bindCountsGetter])

  return (
    <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>
  )
}

export function useConnectionsDomain(): ConnectionsProviderValue {
  const ctx = useContext(ConnectionsContext)
  if (!ctx) {
    const seam = createConnectionsSeam(() => ({}))
    return {
      getSummary: () => seam.getSummary(),
      bindCountsGetter: () => {},
    }
  }
  return ctx
}
