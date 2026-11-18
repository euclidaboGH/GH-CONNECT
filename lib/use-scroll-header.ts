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
  const frameRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const target = e.currentTarget
      const y = target.scrollTop
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        const currentY = target.scrollTop
        const delta = currentY - lastY.current
        const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight)
        const nearBottom = maxScroll > 0 && currentY >= maxScroll - 96
        const nearTop = currentY <= threshold

        setScrollTop(currentY)
        setCompact(currentY > threshold)

        if (hideOnScrollDown && Math.abs(delta) > 10) {
          const shouldHide = !nearTop && !nearBottom && delta > 0 && currentY > threshold + 28
          const shouldReveal = nearTop || nearBottom || delta < -8
          if (shouldHide) setHidden(true)
          else if (shouldReveal) setHidden(false)

          if (shouldHide || shouldReveal) {
            try {
              window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", {
                detail: { hidden: shouldHide, source: "scroll-header" },
              }))
            } catch { /* */ }
          }
        }
        lastY.current = currentY
      })
    },
    [threshold, hideOnScrollDown],
  )

  return { compact, hidden, scrollTop, onScroll, scrollRef }
}
