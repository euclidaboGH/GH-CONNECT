"use client"

/**
 * Messaging READ seam (8-step production pack).
 * Mutations remain on GHC messaging domain / unified adapters.
 */

import React, { createContext, useContext, useMemo, type ReactNode } from "react"
import { useGHCMessaging } from "@/contexts/ghc-context"
import type { Conversation } from "@/lib/ghc-types"

export interface MessagingProviderValue {
  conversations: Conversation[]
  inboxCount: number
  unreadCount: number
}

const MessagingContext = createContext<MessagingProviderValue | null>(null)

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { conversations: raw } = useGHCMessaging()
  const value = useMemo<MessagingProviderValue>(() => {
    const conversations = Array.isArray(raw) ? raw : []
    const unreadCount = conversations.reduce(
      (n, c) => n + (typeof c.unreadCount === "number" ? c.unreadCount : c.unread ? 1 : 0),
      0
    )
    return {
      conversations,
      inboxCount: conversations.length,
      unreadCount,
    }
  }, [raw])

  return (
    <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>
  )
}

export function useMessagingDomain(): MessagingProviderValue {
  const ctx = useContext(MessagingContext)
  if (!ctx) {
    return { conversations: [], inboxCount: 0, unreadCount: 0 }
  }
  return ctx
}
