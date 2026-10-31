"use client"

/** Accessibility: skip past chrome to main app content. */
export function SkipToContent() {
  return (
    <a
      href="#ghc-main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-emerald-700 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
    >
      Skip to content
    </a>
  )
}
