"use client"

import type { ReactNode } from "react"

/**
 * Universal collapsing header — same transition language as Profile.
 *
 * Structure:
 * 1. Expanded block (title, subtitle, actions, optional secondary row)
 *    → slides up / fades when scrolling down
 * 2. Compact sticky bar (avatar/icon + short title + key actions)
 *    → appears after threshold, sticks under safe area
 *
 * Parent should put scrollable content in a sibling with onScroll from useScrollHeader.
 */
export function CollapsingAppHeader({
  title,
  subtitle,
  compact,
  hidden,
  leading,
  actions,
  secondary,
  compactLeading,
  compactTitle,
  className = "",
}: {
  title: string
  subtitle?: string
  /** from useScrollHeader */
  compact: boolean
  /** from useScrollHeader — hide expanded while scrolling down */
  hidden: boolean
  /** Optional left slot in expanded header (e.g. back) */
  leading?: ReactNode
  /** Right-side actions in expanded + compact */
  actions?: ReactNode
  /** Tabs, search, chips under title — collapses with expanded */
  secondary?: ReactNode
  /** Small avatar/icon for compact bar */
  compactLeading?: ReactNode
  /** Override title in compact bar */
  compactTitle?: string
  className?: string
}) {
  return (
    <>
      {/* Compact sticky bar — mirrors Profile compact identity bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 transition-[opacity,transform] duration-300 ease-out ${
          compact
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0"
        }`}
        aria-hidden={!compact}
      >
        <div className="flex items-center gap-2.5 border-b border-gray-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-md sm:px-4">
          {compactLeading ? (
            <div className="shrink-0">{compactLeading}</div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-[11px] font-bold text-white">
              {(compactTitle || title).slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {(compactTitle || title) ? (
              <p className="truncate text-sm font-bold text-gray-900">{compactTitle || title}</p>
            ) : null}
            {subtitle ? (
              <p className={`truncate text-[10px] font-medium text-gray-500 ${(compactTitle || title) ? "" : "text-xs font-semibold text-gray-700"}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </div>
      </div>

      {/* Expanded header — part of scroll stream conceptually; hides on scroll-down */}
      <div
        className={`sticky top-0 z-20 shrink-0 border-b border-gray-100 bg-white/95 backdrop-blur-md transition-[opacity,transform,max-height] duration-300 ease-out ${
          hidden && compact
            ? "pointer-events-none max-h-0 -translate-y-2 overflow-hidden opacity-0 border-transparent"
            : "translate-y-0 opacity-100"
        } ${className}`}
      >
        <div className="px-3 py-1 sm:px-4 sm:py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {leading}
              <div className="min-w-0">
                {title ? (
                  <h2 className="truncate text-base font-bold tracking-tight text-gray-900 sm:text-lg">
                    {title}
                  </h2>
                ) : null}
                {subtitle ? (
                  <p className={`truncate font-medium text-gray-500 ${title ? "text-[10px] leading-tight text-gray-400" : "text-xs font-semibold"}`}>
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
          </div>
          {secondary ? <div className="mt-1.5">{secondary}</div> : null}
        </div>
      </div>
    </>
  )
}
