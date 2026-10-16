"use client"

/**
 * Feed domain provider seam (Prompt #50.1).
 * Presentation over session posts via createFeedSeam — not economy.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  createFeedSeam,
  type SeamPost,
} from "@/lib/domains/adapters/ghc-context-seams"
import type { FeedDomainContract, FeedPostSummary } from "@/lib/domains/contracts/feed"
import type { CanonicalFeedMode } from "@/lib/domains/feed-domain"
import type { DomainResult } from "@/lib/domains/contracts/types"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"

export interface FeedProviderValue {
  mode: CanonicalFeedMode
  setMode: (mode: CanonicalFeedMode) => void
  list: (limit?: number) => DomainResult<FeedPostSummary[]>
  emptyState: () => ReturnType<FeedDomainContract["emptyState"]>
  /** Register a posts getter from GHC compatibility layer */
  bindPostsGetter: (getter: () => SeamPost[]) => void
  isDemoMode: boolean
}

const FeedContext = createContext<FeedProviderValue | null>(null)

export function FeedProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CanonicalFeedMode>("for-you")
  const postsGetterRef = React.useRef<() => SeamPost[]>(() => [])

  const bindPostsGetter = useCallback((getter: () => SeamPost[]) => {
    postsGetterRef.current = getter
  }, [])

  const seam = useMemo(
    () => createFeedSeam(() => postsGetterRef.current()),
    // re-create not required; getter is ref
    []
  )

  const value = useMemo<FeedProviderValue>(
    () => ({
      mode,
      setMode,
      list: (limit = 30) => seam.list(mode, limit),
      emptyState: () => seam.emptyState(mode),
      bindPostsGetter,
      isDemoMode: isDemoDataAllowed(),
    }),
    [mode, seam, bindPostsGetter]
  )

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>
}

export function useFeedDomain(): FeedProviderValue {
  const ctx = useContext(FeedContext)
  if (!ctx) {
    // Safe empty for tests / early mount
    const seam = createFeedSeam(() => [])
    return {
      mode: "for-you",
      setMode: () => {},
      list: (limit) => seam.list("for-you", limit),
      emptyState: () => seam.emptyState("for-you"),
      bindPostsGetter: () => {},
      isDemoMode: isDemoDataAllowed(),
    }
  }
  return ctx
}
