"use client"

/**
 * Notifications READ seam — deep-link friendly summary only.
 * Mark-read / routing stay on notification-center adapters.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type NotificationBucket = "all" | "social" | "messages" | "ghc" | "rewards" | "system"

export interface NotificationsProviderValue {
  bucket: NotificationBucket
  setBucket: (b: NotificationBucket) => void
  openTarget: { screen?: string; id?: string } | null
  setOpenTarget: (t: { screen?: string; id?: string } | null) => void
  clearOpenTarget: () => void
}

const NotificationsContext = createContext<NotificationsProviderValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [bucket, setBucket] = useState<NotificationBucket>("all")
  const [openTarget, setOpenTarget] = useState<{ screen?: string; id?: string } | null>(null)
  const clearOpenTarget = useCallback(() => setOpenTarget(null), [])

  const value = useMemo(
    () => ({ bucket, setBucket, openTarget, setOpenTarget, clearOpenTarget }),
    [bucket, openTarget, clearOpenTarget]
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotificationsDomain(): NotificationsProviderValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    return {
      bucket: "all",
      setBucket: () => {},
      openTarget: null,
      setOpenTarget: () => {},
      clearOpenTarget: () => {},
    }
  }
  return ctx
}
