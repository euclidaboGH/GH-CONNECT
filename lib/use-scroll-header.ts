"use client"

import { useCallback, useRef, useState } from "react"

export interface ScrollHeaderState {
  /** True when past threshold — show compact sticky bar */
  compact: boolean
  /** True while user is scrolling down (header can hide) */
  hidden: boolean
  /** Current scrollTop for optional parallax */
  scrollTop: number
  onScroll: (e: React.UIEvent<HTMLElement>) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Shared scroll-linked header behaviour (profile-class).
 * - Near top: expanded header visible
 * - Scroll down past threshold: compact bar appears, expanded can hide
 * - Scroll up: compact stays until near top again
 */
export function useScrollHeader(options?: {
  /** px before compact mode (default 48) */
  threshold?: number
  /** hide expanded header while scrolling down (default true) */
  hideOnScrollDown?: boolean
}): ScrollHeaderState {
  const threshold = options?.threshold ?? 48
  const hideOnScrollDown = options?.hideOnScrollDown !== false
  const [compact, setCompact] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const lastY = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const y = (e.target as HTMLElement).scrollTop
      setScrollTop(y)
      setCompact(y > threshold)

      if (hideOnScrollDown) {
        const delta = y - lastY.current
        const target = e.target as HTMLElement
        const maxScroll = (target?.scrollHeight || 0) - (target?.clientHeight || 0)
        if (Math.abs(delta) > 12) {
          if (maxScroll > 0 && y >= maxScroll - 96) {
            setHidden(false)
            try {
              window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", { detail: { hidden: false } }))
            } catch { /* */ }
          } else if (y < threshold) {
            setHidden(false)
            try {
              window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", { detail: { hidden: false } }))
            } catch { /* */ }
          } else if (delta > 0 && y > threshold + 28) {
            setHidden(true)
            try {
              window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", { detail: { hidden: true } }))
            } catch { /* */ }
          } else if (delta < -10) {
            setHidden(false)
            try {
              window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", { detail: { hidden: false } }))
            } catch { /* */ }
          }
        }
      }
      lastY.current = y
    },
    [threshold, hideOnScrollDown],
  )

  return { compact, hidden, scrollTop, onScroll, scrollRef }
}
