"use client"

/** Accessibility: skip past chrome to main app content. */
export function SkipToContent() {
  return (
    <a
      href="#ghc-main-content"
      onClick={(event) => {
        const target = document.getElementById("ghc-main-content")
        if (!target) return
        // The destination is a stable landmark with tabindex=-1. Focus it as
        // well as updating the fragment so keyboard and assistive users land
        // inside the application rather than remaining on the skip link.
        event.preventDefault()
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          target.scrollIntoView({ behavior: "smooth", block: "start" })
        } else {
          target.scrollIntoView({ block: "start" })
        }
        target.focus({ preventScroll: true })
        window.history.replaceState(null, "", "#ghc-main-content")
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[max(0.75rem,env(safe-area-inset-top))] focus:z-[100] focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
    >
      Skip to content
    </a>
  )
}
