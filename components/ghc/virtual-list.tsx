"use client"

/**
 * Lightweight windowed list for feed & discovery.
 * No extra dependencies — works in App Studio / mobile WebViews.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

export type VirtualListProps<T> = {
  items: T[]
  /** Estimated row height in px (used for scroll math). */
  estimateSize?: number
  /** Visible overscan rows above/below viewport. */
  overscan?: number
  /** Viewport height; defaults to filling parent (min 320). */
  height?: number
  className?: string
  getItemKey?: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => ReactNode
  /** Empty state when items is empty. */
  empty?: ReactNode
}

export function VirtualList<T>({
  items,
  estimateSize = 280,
  overscan = 3,
  height = 560,
  className = "",
  getItemKey,
  renderItem,
  empty,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const safeItems = Array.isArray(items) ? items : []
  const total = safeItems.length
  const totalHeight = total * estimateSize

  const onScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
  }, [])

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [onScroll])

  const { start, end } = useMemo(() => {
    const viewport = height
    const startIndex = Math.max(0, Math.floor(scrollTop / estimateSize) - overscan)
    const visibleCount = Math.ceil(viewport / estimateSize) + overscan * 2
    const endIndex = Math.min(total, startIndex + visibleCount)
    return { start: startIndex, end: endIndex }
  }, [scrollTop, estimateSize, overscan, height, total])

  if (total === 0) {
    return <>{empty ?? null}</>
  }

  // Small lists: skip virtualization overhead
  if (total <= 12) {
    return (
      <div className={className}>
        {safeItems.map((item, index) => (
          <div key={getItemKey?.(item, index) ?? index}>{renderItem(item, index)}</div>
        ))}
      </div>
    )
  }

  const offsetY = start * estimateSize
  const slice = safeItems.slice(start, end)

  const scrollerStyle: CSSProperties = {
    height,
    overflow: "auto",
    position: "relative",
    WebkitOverflowScrolling: "touch",
  }

  const innerStyle: CSSProperties = {
    height: totalHeight,
    position: "relative",
  }

  const contentStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    transform: `translateY(${offsetY}px)`,
  }

  return (
    <div ref={parentRef} className={className} style={scrollerStyle} role="list">
      <div style={innerStyle}>
        <div style={contentStyle}>
          {slice.map((item, i) => {
            const index = start + i
            return (
              <div
                key={getItemKey?.(item, index) ?? index}
                role="listitem"
                style={{ minHeight: estimateSize }}
              >
                {renderItem(item, index)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
