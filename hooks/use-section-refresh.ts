"use client"

import { useEffect, useRef } from "react"
import {
  attachSoftRefresh,
  type SectionRefreshId,
  type SoftRefreshOptions,
} from "@/lib/client/section-refresh"

/**
 * Screen-level soft refresh. Never mount this on each list row.
 */
export function useSectionRefresh(
  section: SectionRefreshId,
  onRefresh: (reason: string) => void | Promise<void>,
  opts?: SoftRefreshOptions & { enabled?: boolean },
) {
  const cb = useRef(onRefresh)
  cb.current = onRefresh
  const enabled = opts?.enabled !== false

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    return attachSoftRefresh(
      (reason) => {
        try {
          void cb.current(reason)
        } catch {
          /* */
        }
      },
      {
        section,
        minIntervalMs: opts?.minIntervalMs,
        onFocus: opts?.onFocus,
        onVisible: opts?.onVisible,
        onOnline: opts?.onOnline,
        events: opts?.events,
      },
    )
  }, [section, enabled, opts?.minIntervalMs, opts?.onFocus, opts?.onVisible, opts?.onOnline, opts?.events])
}
