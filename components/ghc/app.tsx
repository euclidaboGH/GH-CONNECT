"use client"

import { useState, useCallback, useMemo, memo, useEffect, lazy, Suspense, startTransition, type ReactNode, type UIEvent } from "react"
import { useGHC } from "@/contexts/ghc-context"
import { Newspaper, Compass, Heart, MessagesSquare, UserRound, Users } from "lucide-react"
import { ErrorBoundary } from "@/lib/error-boundary"
import { toUserFacingError } from "@/lib/user-facing-error"
import { ConsentGate } from "./consent-gate"
import { BrandLogo } from "./brand-logo"
import { ThemeApplier } from "./theme-applier"
import { OfflineBanner } from "./offline-banner"
import { afterFirstPaint } from "@/lib/mobile-performance"
import { closeAllActionSheets } from "./action-sheet"
import { dispatchCloseTransientUI } from "@/lib/transient-ui"
import { MatchCelebration } from "./match-celebration"

/** Code-split heavy screens — only Feed is needed for first interactive paint */
const EnhancedFeedScreen = lazy(() => import("./enhanced-feed-screen"))
const Onboarding = lazy(() => import("./onboarding").then((m) => ({ default: m.Onboarding })))
const DiscoveryGridScreen = lazy(() =>
  import("./screens-complete").then((m) => ({ default: m.DiscoveryGridScreen }))
)
const MatchScreen = lazy(() =>
  import("./screens-complete").then((m) => ({ default: m.MatchScreen }))
)
const MessageScreen = lazy(() =>
  import("./screens-complete").then((m) => ({ default: m.MessageScreen }))
)
const ProfileScreen = lazy(() =>
  import("./screens-complete").then((m) => ({ default: m.ProfileScreen }))
)
const CommunitiesScreen = lazy(() =>
  import("./communities-screen").then((m) => ({ default: m.CommunitiesScreen }))
)
const SettingsScreen = lazy(() =>
  import("./settings").then((m) => ({ default: m.SettingsScreen }))
)

function TabScreenFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col gap-3 bg-background px-4 py-6" role="status" aria-live="polite" aria-label={`Loading ${label}`}>
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-muted" />
      <div className="h-24 animate-pulse rounded-3xl bg-muted/80" />
      <div className="h-40 animate-pulse rounded-3xl bg-muted/70" />
      <div className="h-40 animate-pulse rounded-3xl bg-muted/60" />
      <p className="pt-2 text-center text-[11px] font-medium text-muted-foreground">Loading {label}…</p>
    </div>
  )
}

function ScreenBoundary({ children, label, onReset, onDismiss }: { children: ReactNode; label: string; onReset?: () => void; onDismiss?: () => void }) {
  return (
    <ErrorBoundary
      label={label}
      onRetry={onReset}
      onDismiss={onDismiss}
      fallback={(error, retry) => (
        <div className="flex min-h-full items-center justify-center bg-background px-6 py-12" role="alert">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden="true">!</div>
            <h2 className="text-lg font-bold text-foreground">{label} needs a refresh</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {toUserFacingError(error).message}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">We kept your account safe. Try loading this screen again.</p>
            {process.env.NODE_ENV !== "production" && error?.message ? (
              <p className="mt-2 max-h-16 overflow-auto rounded-lg bg-muted px-2 py-1 text-left text-[10px] font-mono text-muted-foreground">{error.message}</p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onReset?.()
                retry()
              }}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                retry()
                onDismiss?.()
                onReset?.()
              }}
              className="mt-3 min-h-11 w-full text-sm font-semibold text-muted-foreground underline underline-offset-2"
            >
              Dismiss
            </button>
            <p className="mt-3 text-xs text-muted-foreground">No progress or profile data was removed.</p>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

// Memoized toast component (Quick Win: prevent unnecessary re-renders)
const Toast = memo(({ message, type }: { message: string; type: string }) => {
  const bgClass =
    type === "success"
      ? "bg-green-500"
      : type === "error"
        ? "bg-destructive"
        : "bg-blue-500"

  return (
    <div role={type === "error" ? "alert" : "status"} aria-live={type === "error" ? "assertive" : "polite"} className={`${bgClass} text-white px-4 py-2 rounded-full text-[14px] font-bold`}>
      {message}
    </div>
  )
})

// Memoized navigation items to prevent recalculation
const NAV_ITEMS = [
  { id: "home", icon: Newspaper, label: "Feed" },
  { id: "discover", icon: Compass, label: "Find" },
  { id: "matches", icon: Heart, label: "Matches" },
  { id: "communities", icon: Users, label: "Community" },
  { id: "messages", icon: MessagesSquare, label: "Messages" },
  { id: "profile", icon: UserRound, label: "Profile" },
] as const

const NAV_IDS = ["home", "discover", "matches", "communities", "messages", "profile"] as const

function scrollActiveTabToTop() {
  try {
    const main = document.querySelector("main")
    if (!main) return
    const active = main.querySelector('[style*="pointer-events: auto"], [style*="pointer-events:auto"]') as HTMLElement | null
    const scroller = active?.querySelector(".overflow-y-auto, [class*=\"overflow-y-auto\"]") as HTMLElement | null
    ;(scroller || active || main).scrollTo?.({ top: 0, behavior: "smooth" })
  } catch {
    /* */
  }
}

/**
 * Shared scroll → bottom-nav visibility.
 * Hysteresis + near-bottom ignore prevents end-of-list vibration loops.
 */
function onTabScrollHideNav(e: UIEvent<HTMLElement>) {
  const el = e.currentTarget
  const y = el.scrollTop
  const prev = Number(el.dataset.scrollY || 0)
  const delta = y - prev
  el.dataset.scrollY = String(y)
  if (Math.abs(delta) < 14) return
  const maxScroll = el.scrollHeight - el.clientHeight
  // Near bottom: always show nav — never toggle (stops bounce feedback)
  if (maxScroll > 0 && y >= maxScroll - 96) {
    try {
      window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", { detail: { hidden: false } }))
    } catch { /* */ }
    return
  }
  try {
    if (delta > 0 && y > 72) {
      window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", { detail: { hidden: true } }))
    } else if (delta < -10) {
      window.dispatchEvent(new CustomEvent("ghc:bottom-nav-visibility", { detail: { hidden: false } }))
    }
  } catch { /* */ }
}

export function GHConnectApp() {
  const { ready, profile, tab, setTab, toasts, matchCelebration, dismissMatchCelebration, startConversation, candidates } = useGHC()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "main" | "wallet" | "rewards" | "membership" | "help"
  >("main")
  /** Auto-hide bottom nav while scrolling down; reveal on scroll-up or tap */
  const [bottomNavHidden, setBottomNavHidden] = useState(false)
  const openSettings = useCallback((section: typeof settingsInitialSection = "main") => {
    setSettingsInitialSection(section)
    setSettingsOpen(true)
    setBottomNavHidden(false)
  }, [])
  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    setSettingsInitialSection("main")
  }, [])
  /** Mount a tab once visited so switches stay instant without loading all 6 at boot */
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(["home"]))
  const [hiddenToastIds, setHiddenToastIds] = useState<Set<string>>(new Set())
  const [screenResetKeys, setScreenResetKeys] = useState<Record<string, number>>({})
  const resetScreen = useCallback((screen: string) => setScreenResetKeys((current) => ({ ...current, [screen]: (current[screen] || 0) + 1 })), [])
  const activeTab = NAV_IDS.includes(tab as (typeof NAV_IDS)[number]) ? tab : "home"
  useEffect(() => {
    setVisitedTabs((prev) => {
      const next = new Set(prev)
      next.add(activeTab)
      // Cap keep-alive to 3 tabs on low-end WebViews (home + active + 1 recent)
      if (next.size > 3) {
        const order = ["home", activeTab, ...[...next].filter((id) => id !== "home" && id !== activeTab)]
        return new Set(order.slice(0, 3))
      }
      return next
    })
    // Section change: dispose all temporary overlays (menus, previews, sheets, compose)
    closeAllActionSheets()
    dispatchCloseTransientUI({ reason: "tab-change", tab: activeTab })
    // Settings is a major overlay — close when switching primary tabs
    setSettingsOpen(false)
    setSettingsInitialSection("main")
    setBottomNavHidden(false)
  }, [activeTab])

  // Bottom nav auto-hide driven by scroll direction (from useScrollHeader + tab scroll shells)
  useEffect(() => {
    const onVis = (e: Event) => {
      const hidden = (e as CustomEvent<{ hidden?: boolean }>).detail?.hidden
      if (typeof hidden === "boolean") setBottomNavHidden(hidden)
    }
    window.addEventListener("ghc:bottom-nav-visibility", onVis)
    return () => window.removeEventListener("ghc:bottom-nav-visibility", onVis)
  }, [])

  // Browser back / page show: clear disposable overlays without wiping domain state
  useEffect(() => {
    const onPop = () => dispatchCloseTransientUI({ reason: "back" })
    const onPageShow = () => dispatchCloseTransientUI({ reason: "refresh" })
    window.addEventListener("popstate", onPop)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.removeEventListener("popstate", onPop)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  // Prefetch secondary chunks only after idle — do not compete with first paint / Feed
  useEffect(() => {
    afterFirstPaint(() => {
      // Stagger: settings is smaller; screens-complete is large — delay slightly more
      void import("./settings")
      window.setTimeout(() => {
        void import("./screens-complete")
      }, 1200)
    })
  }, [])

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const target = (event as CustomEvent<string>).detail
      if (NAV_IDS.includes(target as (typeof NAV_IDS)[number])) {
        startTransition(() => setTab(target as any))
      }
    }
    window.addEventListener("ghc:navigate-tab", handleNavigate)
    return () => window.removeEventListener("ghc:navigate-tab", handleNavigate)
  }, [setTab])

  useEffect(() => {
    const visibleToasts = (toasts ?? []).slice(0, 2)
    const timers = visibleToasts.map((toast) =>
      window.setTimeout(() => {
        setHiddenToastIds((current) => {
          const next = new Set(current)
          next.add(toast.id)
          return next
        })
      }, 3200),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [toasts])

  const visibleToasts = (toasts ?? []).filter((toast) => !hiddenToastIds.has(toast.id)).slice(0, 2)

  // Keyboard navigation support (number keys 1-7 for tabs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) return
      const key = parseInt(e.key)
      if (key >= 1 && key <= 6) {
        if (NAV_IDS[key - 1]) startTransition(() => setTab(NAV_IDS[key - 1]))
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setTab, settingsOpen])

  // Always mount ThemeApplier so appearance updates even on loading / onboarding shells
  const themeLayer = <ThemeApplier />

  if (!ready) {
    return (
      <>
      {themeLayer}
      <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[#050a08] px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18)_0%,transparent_60%)]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="absolute inset-0 scale-110 rounded-full bg-emerald-400/20 blur-3xl" />
            <BrandLogo size="hero" priority className="relative drop-shadow-[0_0_40px_rgba(16,185,129,0.45)]" />
          </div>
          <div className="mt-8 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-400" role="status" aria-label="Loading" />
          <p className="mt-5 text-sm font-semibold tracking-wide text-emerald-300/90">Welcome</p>
          <p className="mt-1 text-[11px] text-white/40">Loading your profile…</p>
        </div>
      </div>
      </>
    )
  }

  if (!profile?.onboarded) {
    return (
      <>
        {themeLayer}
        <ConsentGate>
          <ScreenBoundary label="Onboarding">
            <Suspense fallback={<TabScreenFallback label="Welcome" />}>
              <Onboarding />
            </Suspense>
          </ScreenBoundary>
        </ConsentGate>
      </>
    )
  }

  if (settingsOpen) {
    return (
      <>
        {themeLayer}
        <ConsentGate>
          {/* Full-viewport shell so h-full children (Wallet / Rewards / Membership / Settings) size correctly */}
          <div className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-md mx-auto relative">
            <ScreenBoundary
              label="Settings"
              onReset={() => setScreenResetKeys((c) => ({ ...c, settings: (c.settings || 0) + 1 }))}
              onDismiss={closeSettings}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<TabScreenFallback label="Settings" />}>
                  <SettingsScreen key={`${screenResetKeys.settings || 0}-${settingsInitialSection}`} onBack={closeSettings} initialSection={settingsInitialSection} />
                </Suspense>
              </div>
            </ScreenBoundary>
          </div>
        </ConsentGate>
      </>
    )
  }

  return (
    <>
    {themeLayer}
    <ConsentGate>
    <div
      className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-md mx-auto relative"
      data-nav-hidden={bottomNavHidden ? "true" : "false"}
    >
      <OfflineBanner />
      {/* Main content — tap reveals bottom nav when it was auto-hidden */}
      <main
        className="relative z-0 min-h-0 flex-1 overflow-hidden bg-background"
        onPointerDown={() => {
          if (bottomNavHidden) setBottomNavHidden(false)
        }}
      >
        {/* Content fills the flex area above the nav. Modest pb only for last-item breathing room. */}
        {visitedTabs.has("home") && (
        <div aria-hidden={activeTab !== "home"} className="absolute inset-0 transition-opacity duration-150" style={{ opacity: activeTab === "home" ? 1 : 0, pointerEvents: activeTab === "home" ? "auto" : "none", contentVisibility: activeTab === "home" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div
            className="gh-scroll-stable h-full overflow-y-auto overscroll-y-contain touch-pan-y scrollbar-hide pb-[var(--gh-bottom-content-inset)] [-webkit-overflow-scrolling:touch]"
            onScroll={onTabScrollHideNav}
          >
            <ScreenBoundary label="Feed" onReset={() => resetScreen("home")}>
              <Suspense fallback={<TabScreenFallback label="Feed" />}>
                <EnhancedFeedScreen key={screenResetKeys.home || 0} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("discover") && (
        <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: activeTab === "discover" ? 1 : 0, pointerEvents: activeTab === "discover" ? "auto" : "none", contentVisibility: activeTab === "discover" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div className="h-full min-h-0 overflow-hidden">
            <ScreenBoundary label="Discover" onReset={() => resetScreen("discover")}>
              <Suspense fallback={<TabScreenFallback label="Find" />}>
                <DiscoveryGridScreen key={screenResetKeys.discover || 0} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("matches") && (
        <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: activeTab === "matches" ? 1 : 0, pointerEvents: activeTab === "matches" ? "auto" : "none", contentVisibility: activeTab === "matches" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div
            className="gh-scroll-stable h-full overflow-y-auto overscroll-y-contain touch-pan-y scrollbar-hide pb-[var(--gh-bottom-content-inset)] [-webkit-overflow-scrolling:touch]"
            onScroll={onTabScrollHideNav}
          >
            <ScreenBoundary label="Matches" onReset={() => resetScreen("matches")}>
              <Suspense fallback={<TabScreenFallback label="Matches" />}>
                <MatchScreen key={screenResetKeys.matches || 0} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("communities") && (
        <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: activeTab === "communities" ? 1 : 0, pointerEvents: activeTab === "communities" ? "auto" : "none", contentVisibility: activeTab === "communities" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div
            className="gh-scroll-stable h-full overflow-y-auto overscroll-y-contain touch-pan-y scrollbar-hide pb-[var(--gh-bottom-content-inset)] [-webkit-overflow-scrolling:touch]"
            onScroll={onTabScrollHideNav}
          >
            <ScreenBoundary label="Community">
              <Suspense fallback={<TabScreenFallback label="Community" />}>
                <CommunitiesScreen />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("messages") && (
        <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: activeTab === "messages" ? 1 : 0, pointerEvents: activeTab === "messages" ? "auto" : "none", contentVisibility: activeTab === "messages" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div className="h-full min-h-0 overflow-hidden">
            <ScreenBoundary label="Messages" onReset={() => resetScreen("messages")}>
              <Suspense fallback={<TabScreenFallback label="Messages" />}>
                <MessageScreen key={screenResetKeys.messages || 0} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("profile") && (
        <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: activeTab === "profile" ? 1 : 0, pointerEvents: activeTab === "profile" ? "auto" : "none", contentVisibility: activeTab === "profile" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div
            className="gh-scroll-stable h-full min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y scrollbar-hide pb-[var(--gh-bottom-content-inset)] [-webkit-overflow-scrolling:touch]"
            onScroll={onTabScrollHideNav}
          >
            <ScreenBoundary label="Profile" onReset={() => resetScreen("profile")}>
              <Suspense fallback={<TabScreenFallback label="Profile" />}>
                <ProfileScreen key={screenResetKeys.profile || 0} onSettings={() => openSettings("main")} onOpenWallet={() => openSettings("wallet")} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
      </main>

      {/* Bottom navigation — fixed to bottom edge so main can use full height.
          Auto-hides on scroll-down (translate off-screen); tap or scroll-up reveals.
          Hairline border only — no heavy shadow overlay. */}
      <nav
        className={`absolute inset-x-0 bottom-0 z-50 flex w-full items-end border-t border-border/70 bg-card/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1 backdrop-blur-md transition-transform duration-200 ease-out sm:px-2 ${
          bottomNavHidden ? "translate-y-[calc(100%+2px)] pointer-events-none" : "translate-y-0"
        }`}
        aria-label="Main navigation"
        role="navigation"
        aria-hidden={bottomNavHidden}
        style={{
          minHeight: "var(--gh-bottom-nav-height)",
        }}
      >
        <div className="flex w-full items-stretch justify-between gap-0.5">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: id }))
                  } catch {
                    /* */
                  }
                  startTransition(() => setTab(id as any))
                }}
                className={`group relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background motion-safe:active:scale-95 ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={isActive ? `${label}, current tab` : `Go to ${label}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary transition-opacity duration-150 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`flex h-8 w-10 items-center justify-center rounded-lg transition-colors ${
                    isActive ? "bg-primary/10" : "bg-transparent"
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
                    fill={isActive && id === "matches" ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={`max-w-full truncate text-[10px] font-bold leading-none tracking-tight ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <MatchCelebration
        open={Boolean(matchCelebration)}
        userName={matchCelebration?.userName || ""}
        userPhoto={matchCelebration?.userPhoto || ""}
        onClose={() => dismissMatchCelebration?.()}
        onContinue={() => {
          dismissMatchCelebration?.()
          setTab("discover" as any)
        }}
        onMessage={() => {
          const id = matchCelebration?.userId
          const name = matchCelebration?.userName || "Match"
          const photo = matchCelebration?.userPhoto || ""
          dismissMatchCelebration?.()
          if (id) {
            void startConversation?.(id, name, photo)
            setTab("messages" as any)
            try {
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
            } catch {
              /* */
            }
          }
        }}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-[var(--gh-bottom-content-inset)] z-40 mx-auto flex max-w-md flex-col items-center gap-2 px-4">
        {visibleToasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
    </div>
    </ConsentGate>
    </>
  )
}
