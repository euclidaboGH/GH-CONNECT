"use client"

/**
 * Discovery READ seam (Step 4).
 * Uses createDiscoverySeam — production seed isolation preserved inside seam.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { createDiscoverySeam } from "@/lib/domains/adapters/ghc-context-seams"
import type {
  DiscoveryCandidate,
  DiscoveryQuery,
} from "@/lib/domains/contracts/discovery"
import type { DomainResult } from "@/lib/domains/contracts/types"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"

export interface DiscoveryProviderValue {
  search: (query: DiscoveryQuery) => DomainResult<DiscoveryCandidate[]>
  bindCandidatesGetter: (getter: () => Array<Record<string, unknown>>) => void
  isDemoMode: boolean
}

const DiscoveryContext = createContext<DiscoveryProviderValue | null>(null)

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const getterRef = useRef<() => Array<Record<string, unknown>>>(() => [])

  const bindCandidatesGetter = useCallback(
    (getter: () => Array<Record<string, unknown>>) => {
      getterRef.current = getter
    },
    []
  )

  const value = useMemo<DiscoveryProviderValue>(() => {
    const seam = createDiscoverySeam(() => getterRef.current())
    return {
      search: (query) => seam.search(query),
      bindCandidatesGetter,
      isDemoMode: isDemoDataAllowed(),
    }
  }, [bindCandidatesGetter])

  return (
    <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>
  )
}

export function useDiscoveryDomain(): DiscoveryProviderValue {
  const ctx = useContext(DiscoveryContext)
  if (!ctx) {
    const seam = createDiscoverySeam(() => [])
    return {
      search: (query) => seam.search(query),
      bindCandidatesGetter: () => {},
      isDemoMode: isDemoDataAllowed(),
    }
  }
  return ctx
}
