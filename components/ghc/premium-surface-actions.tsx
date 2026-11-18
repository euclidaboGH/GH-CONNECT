"use client"

/**
 * Shared header actions for Marketplace + Ecosystem + notifications.
 * Compact inline chrome keeps the app header thin and gives content the full width.
 */
import { lazy, Suspense } from "react"
import { LayoutGrid, ShoppingBag } from "lucide-react"

const NotificationBell = lazy(() =>
  import("./notification-bell").then((m) => ({ default: m.NotificationBell }))
)

export function PremiumSurfaceActions({
  className = "",
  showLabels = false,
}: {
  className?: string
  showLabels?: boolean
}) {
  const openMarketplace = () => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:open-marketplace", { detail: { bucket: "browse" } }))
    } catch { /* */ }
  }
  const openEcosystem = () => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:open-ecosystem", { detail: {} }))
    } catch { /* */ }
  }

  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 text-foreground/80 transition hover:bg-emerald-50/80 hover:text-emerald-900 active:scale-95 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

  return (
    <div className={`flex items-center gap-0 ${className}`} role="group" aria-label="GreenHaven surfaces and notifications">
      <button type="button" onClick={openMarketplace} className={btn} aria-label="Open Marketplace" title="Marketplace">
        <ShoppingBag size={17} aria-hidden />
        {showLabels ? <span className="text-[11px] font-bold">Market</span> : null}
      </button>
      <button type="button" onClick={openEcosystem} className={btn} aria-label="Open Ecosystem" title="Ecosystem">
        <LayoutGrid size={17} aria-hidden />
        {showLabels ? <span className="text-[11px] font-bold">Hub</span> : null}
      </button>
      <Suspense fallback={<span className="inline-block h-9 w-9" aria-hidden="true" />}>
        <NotificationBell />
      </Suspense>
    </div>
  )
}
