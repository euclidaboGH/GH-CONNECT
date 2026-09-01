"use client"

import { useState, useCallback, useMemo, memo, useEffect, lazy, Suspense, startTransition, type ReactNode, type UIEvent } from "react"
import { useGHCShell, useGHCProfile, useGHCDiscovery } from "@/contexts/ghc-context"
import { Newspaper, Compass, Plus, MessagesSquare, UserRound, Heart, Users } from "lucide-react"
import { ErrorBoundary } from "@/lib/error-boundary"
import { toUserFacingError } from "@/lib/user-facing-error"
import { ConsentGate } from "./consent-gate"
import { BrandLogo } from "./brand-logo"
import { ThemeApplier } from "./theme-applier"
import { OfflineBanner } from "./offline-banner"
import { afterFirstPaint } from "@/lib/mobile-performance"
import { closeAllActionSheets } from "./action-sheet"
import { dispatchCloseTransientUI } from "@/lib/transient-ui"
import type { CreateHubAction } from "./create-hub-sheet"

const CreateHubSheet = lazy(() =>
  import("./create-hub-sheet").then((m) => ({ default: m.CreateHubSheet }))
)
const PollComposer = lazy(() =>
  import("./poll-composer").then((m) => ({ default: m.PollComposer }))
)
const ChallengeComposer = lazy(() =>
  import("./challenge-composer").then((m) => ({ default: m.ChallengeComposer }))
)

/** Code-split heavy screens — only Feed is needed for first interactive paint */
const EnhancedFeedScreen = lazy(() => import("./enhanced-feed-screen"))
const Onboarding = lazy(() => import("./onboarding").then((m) => ({ default: m.Onboarding })))
const DiscoveryGridScreen = lazy(() =>
  import("./discovery-grid-screen").then((m) => ({ default: m.DiscoveryGridScreen }))
)
const MatchScreen = lazy(() =>
  import("./match-screen").then((m) => ({ default: m.MatchScreen }))
)
const MessageScreen = lazy(() =>
  import("./message-screen").then((m) => ({ default: m.MessageScreen }))
)
const ProfileScreen = lazy(() =>
  import("./profile-screen").then((m) => ({ default: m.ProfileScreen }))
)
const CommunitiesScreen = lazy(() =>
  import("./communities-screen").then((m) => ({ default: m.CommunitiesScreen }))
)
const SettingsScreen = lazy(() =>
  import("./settings").then((m) => ({ default: m.SettingsScreen || m.default }))
)
const PremiumWalletScreen = lazy(() =>
  import("@/features/wallet").then((m) => ({ default: m.PremiumWalletScreen }))
)
const GreenHavenEcosystemLazy = lazy(() =>
  import("./greenhaven-ecosystem-screen").then((m) => ({ default: m.GreenHavenEcosystemScreen }))
)
const MatchCelebrationLazy = lazy(() =>
  import("./match-celebration").then((m) => ({ default: m.MatchCelebration }))
)

function TabScreenFallback({ label }: { label: string }) {
  return (
    <div
      className="flex h-full min-h-[50vh] flex-col gap-3 bg-background px-3 pt-4"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${label}`}
    >
      <div className="mx-auto flex w-full max-w-[var(--gh-content-max,28rem)] flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
        <div className="h-16 animate-pulse rounded-2xl bg-muted/70" />
        <div className="space-y-2 rounded-2xl border border-border/40 p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-full animate-pulse rounded bg-muted/80" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted/60" />
          <div className="mt-2 h-28 animate-pulse rounded-xl bg-muted/50" />
        </div>
        <div className="h-20 animate-pulse rounded-2xl bg-muted/40" />
      </div>
      <p className="pt-2 text-center text-[11px] font-semibold text-muted-foreground">Loading {label}…</p>
    </div>
  )
}


/** Prefetch non-home tab chunks after first paint — faster tab switches without boot cost */
function prefetchTabChunks() {
  void import("./discovery-grid-screen")
  void import("./message-screen")
  void import("./profile-screen")
  void import("./communities-screen")
  void import("./match-screen")
  void import("@/features/wallet")
  void import("./greenhaven-ecosystem-screen")
  void import("./create-hub-sheet")
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
/** Primary destinations only — secondary (Wallet, Rewards, Communities, Matches…) live under Profile */
const NAV_ITEMS = [
  { id: "home", icon: Newspaper, label: "Home" },
  { id: "discover", icon: Compass, label: "Discover" },
  { id: "create", icon: Plus, label: "Create" },
  { id: "messages", icon: MessagesSquare, label: "Messages" },
  { id: "profile", icon: UserRound, label: "Profile" },
] as const

/** Keyboard + deep-link still support secondary tabs */
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
  const { ready, tab, setTab, toasts, matchCelebration, dismissMatchCelebration, startConversation } = useGHCShell()
  const { profile } = useGHCProfile()
  const { candidates } = useGHCDiscovery()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "main" | "wallet" | "rewards" | "membership" | "help"
  >("main")
  /** Direct GHC Wallet overlay — not nested under Settings */
  const [walletOpen, setWalletOpen] = useState(false)
  const [showCreateHub, setShowCreateHub] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [ecosystemOpen, setEcosystemOpen] = useState(false)
  /** Auto-hide bottom nav while scrolling down; reveal on scroll-up or tap */
  const [bottomNavHidden, setBottomNavHidden] = useState(false)
  const openSettings = useCallback((section: typeof settingsInitialSection = "main") => {
    setSettingsInitialSection(section)
    setSettingsOpen(true)
    setShowCreateHub(false)
    setPollOpen(false)
    setChallengeOpen(false)
    setBottomNavHidden(false)
    try { window.dispatchEvent(new CustomEvent("ghc:close-compose")) } catch { /* */ }
  }, [])
  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    setSettingsInitialSection("main")
  }, [])
  const openWallet = useCallback(() => {
    setWalletOpen(true)
    setShowCreateHub(false)
    setBottomNavHidden(false)
    try { window.dispatchEvent(new CustomEvent("ghc:close-compose")) } catch { /* */ }
  }, [])
  const closeWallet = useCallback(() => {
    setWalletOpen(false)
  }, [])
  useEffect(() => {
    const openEco = () => {
      setSettingsOpen(false)
      setSettingsInitialSection("main")
      setWalletOpen(false)
      setShowCreateHub(false)
      setBottomNavHidden(false)
      setEcosystemOpen(true)
    }
    window.addEventListener("ghc:open-ecosystem", openEco)
    return () => window.removeEventListener("ghc:open-ecosystem", openEco)
  }, [])

  // Deep-links from notifications / identity cards
  useEffect(() => {
    const onWallet = () => openWallet()
    const onRewards = () => openSettings("rewards")
    const onSettings = (e: Event) => {
      const section = (e as CustomEvent).detail?.section
      const allowed = ["main", "wallet", "rewards", "membership", "help"] as const
      const s = allowed.includes(section) ? section : "main"
      openSettings(s)
    }
    const onStartChat = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      const userId = String(d.userId || "").trim()
      if (userId && startConversation) {
        try {
          void startConversation(userId)
        } catch {
          /* */
        }
      }
      startTransition(() => setTab("messages" as any))
    }
    window.addEventListener("ghc:open-wallet", onWallet)
    window.addEventListener("ghc:open-rewards", onRewards)
    window.addEventListener("ghc:open-settings", onSettings)
    window.addEventListener("ghc:start-chat", onStartChat)
    return () => {
      window.removeEventListener("ghc:open-wallet", onWallet)
      window.removeEventListener("ghc:open-rewards", onRewards)
      window.removeEventListener("ghc:open-settings", onSettings)
      window.removeEventListener("ghc:start-chat", onStartChat)
    }
  }, [openWallet, openSettings, startConversation, setTab])
  /** Mount a tab once visited so switches stay instant without loading all 6 at boot */
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(["home"]))

  // After Home is interactive, warm the next likely tabs (idle / timeout)
  useEffect(() => {
    let cancelled = false
    afterFirstPaint(() => {
      if (cancelled) return
      const ric = (
        window as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
      ).requestIdleCallback
      const run = () => {
        if (!cancelled) prefetchTabChunks()
      }
      if (typeof ric === "function") {
        ric(run, { timeout: 2500 })
      } else {
        window.setTimeout(run, 1200)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])
  const [hiddenToastIds, setHiddenToastIds] = useState<Set<string>>(new Set())
  const [screenResetKeys, setScreenResetKeys] = useState<Record<string, number>>({})
  const resetScreen = useCallback((screen: string) => setScreenResetKeys((current) => ({ ...current, [screen]: (current[screen] || 0) + 1 })), [])
  const activeTab = NAV_IDS.includes(tab as (typeof NAV_IDS)[number]) ? tab : "home"
  useEffect(() => {
    setVisitedTabs((prev) => {
      // Performance budget: Home always warm + active + previous tab
      // (prefetch warms the JS chunk; keep one prior tab mounted for instant back)
      const next = new Set<string>(["home", activeTab])
      for (const id of prev) {
        if (id !== "home" && id !== activeTab && next.size < 3) next.add(id)
      }
      return next
    })
    // Section change: dispose all temporary overlays (menus, previews, sheets, compose)
    closeAllActionSheets()
    dispatchCloseTransientUI({ reason: "tab-change", tab: activeTab })
    // Settings / Wallet overlays — close when switching primary tabs
    setSettingsOpen(false)
    setSettingsInitialSection("main")
    setWalletOpen(false)
    setEcosystemOpen(false)
    setShowCreateHub(false)
    setPollOpen(false)
    setChallengeOpen(false)
    setBottomNavHidden(false)
    try {
      window.dispatchEvent(new CustomEvent("ghc:tab-change", { detail: activeTab }))
      window.dispatchEvent(new CustomEvent("ghc:close-compose"))
    } catch {
      /* */
    }
  }, [activeTab])

  // Bottom nav auto-hide driven by scroll direction (from useScrollHeader + tab scroll shells)
  useEffect(() => {
    const onVis = (e: Event) => {
      const hidden = (e as CustomEvent<{ hidden?: boolean }>).detail?.hidden
      if (typeof hidden === "boolean") setBottomNavHidden(hidden)
    }
    window.addEventListener("ghc:bottom-nav-visibility", onVis)
    const onCreateHub = () => setShowCreateHub(true)
    window.addEventListener("ghc:open-create-hub", onCreateHub)
    const onPoll = () => setPollOpen(true)
    const onChallenge = () => setChallengeOpen(true)
    window.addEventListener("ghc:open-poll", onPoll)
    window.addEventListener("ghc:open-challenge", onChallenge)
    return () => {
      window.removeEventListener("ghc:bottom-nav-visibility", onVis)
      window.removeEventListener("ghc:open-create-hub", onCreateHub)
      window.removeEventListener("ghc:open-poll", onPoll)
      window.removeEventListener("ghc:open-challenge", onChallenge)
    }
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

  // Prefetch next-likely tabs after first paint (idle) — snappier tab switches
  useEffect(() => {
    afterFirstPaint(() => {
      const warm = () => {
        void import("./discovery-grid-screen")
        void import("./message-screen")
        void import("./profile-screen")
      }
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        ;(window as any).requestIdleCallback(warm, { timeout: 1800 })
      } else {
        window.setTimeout(warm, 400)
      }
      window.setTimeout(() => {
        void import("./settings")
        void import("@/features/wallet")
      }, 2200)
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

  if (walletOpen) {
    return (
      <>
        {themeLayer}
        <ConsentGate>
          <div className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-[var(--gh-content-max,28rem)] mx-auto relative w-full">
            <ScreenBoundary
              label="GHC Wallet"
              onReset={() => setScreenResetKeys((c) => ({ ...c, wallet: (c.wallet || 0) + 1 }))}
              onDismiss={closeWallet}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<TabScreenFallback label="Wallet" />}>
                  <PremiumWalletScreen key={screenResetKeys.wallet || 0} onBack={closeWallet} />
                </Suspense>
              </div>
            </ScreenBoundary>
          </div>
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
          <div className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-[var(--gh-content-max,28rem)] mx-auto relative w-full">
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

  /* Secondary full-screen flows — no bottom navigation in the tree */
  if (ecosystemOpen) {
    return (
      <>
        {themeLayer}
        <ConsentGate>
          <div className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-[var(--gh-content-max,28rem)] mx-auto relative w-full">
            <ScreenBoundary
              label="GreenHaven Ecosystem"
              onDismiss={() => setEcosystemOpen(false)}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<TabScreenFallback label="Ecosystem" />}>
                  <GreenHavenEcosystemLazy onBack={() => setEcosystemOpen(false)} />
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
      className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-[var(--gh-content-max,28rem)] mx-auto relative w-full"
      data-nav-hidden={bottomNavHidden ? "true" : "false"}
      data-nav-in-flow="true"
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
        <div aria-hidden={activeTab !== "home"} className="absolute inset-0 transition-opacity duration-75" style={{ opacity: activeTab === "home" ? 1 : 0, pointerEvents: activeTab === "home" ? "auto" : "none", contentVisibility: activeTab === "home" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div className="h-full min-h-0 overflow-hidden" onScrollCapture={onTabScrollHideNav}>
            <ScreenBoundary label="Feed" onReset={() => resetScreen("home")}>
              <Suspense fallback={<TabScreenFallback label="Feed" />}>
                <EnhancedFeedScreen key={screenResetKeys.home || 0} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("discover") && (
        <div className="absolute inset-0 transition-opacity duration-75" style={{ opacity: activeTab === "discover" ? 1 : 0, pointerEvents: activeTab === "discover" ? "auto" : "none", contentVisibility: activeTab === "discover" ? "visible" : "hidden", contain: "layout paint style" }}>
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
        <div className="absolute inset-0 transition-opacity duration-75" style={{ opacity: activeTab === "matches" ? 1 : 0, pointerEvents: activeTab === "matches" ? "auto" : "none", contentVisibility: activeTab === "matches" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div
            className="gh-scroll-root gh-scroll-stable h-full touch-pan-y scrollbar-hide"
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
        <div className="absolute inset-0 transition-opacity duration-75" style={{ opacity: activeTab === "communities" ? 1 : 0, pointerEvents: activeTab === "communities" ? "auto" : "none", contentVisibility: activeTab === "communities" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div
            className="gh-scroll-root gh-scroll-stable h-full touch-pan-y scrollbar-hide"
            onScroll={onTabScrollHideNav}
          >
            <ScreenBoundary label="Community" onReset={() => resetScreen("communities")}>
              <Suspense fallback={<TabScreenFallback label="Community" />}>
                <CommunitiesScreen key={screenResetKeys.communities || 0} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("messages") && (
        <div className="absolute inset-0 transition-opacity duration-75" style={{ opacity: activeTab === "messages" ? 1 : 0, pointerEvents: activeTab === "messages" ? "auto" : "none", contentVisibility: activeTab === "messages" ? "visible" : "hidden", contain: "layout paint style" }}>
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
        <div className="absolute inset-0 transition-opacity duration-75" style={{ opacity: activeTab === "profile" ? 1 : 0, pointerEvents: activeTab === "profile" ? "auto" : "none", contentVisibility: activeTab === "profile" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div
            className="gh-scroll-root gh-scroll-stable h-full min-h-0 touch-pan-y scrollbar-hide"
            onScroll={onTabScrollHideNav}
          >
            <ScreenBoundary label="Profile" onReset={() => resetScreen("profile")}>
              <Suspense fallback={<TabScreenFallback label="Profile" />}>
                <ProfileScreen key={screenResetKeys.profile || 0} onSettings={() => openSettings("main")} onOpenWallet={openWallet} />
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
        className={`gh-bottom-nav relative z-40 flex w-full shrink-0 items-end border-t border-border/60 bg-background px-1 pb-[max(0.2rem,env(safe-area-inset-bottom,0px))] pt-0.5 transition-[max-height,opacity,transform] duration-200 ease-out sm:px-2 ${
          bottomNavHidden || showCreateHub ? "max-h-0 overflow-hidden opacity-0 pointer-events-none border-transparent" : "max-h-[4.5rem] opacity-100"
        }`}
        aria-label="Main navigation"
        role="navigation"
        aria-hidden={bottomNavHidden || showCreateHub}
        style={{
          minHeight: "var(--gh-bottom-nav-height)",
          /* Crisp edge — no soft gradient “shadow band” above the bar */
          boxShadow: "none",
        }}
      >
        <div className="flex w-full items-stretch justify-between gap-0.5">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
            const isActive = id !== "create" && activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === "create") {
                    setShowCreateHub(true)
                    return
                  }
                  if (isActive) {
                    scrollActiveTabToTop()
                    return
                  }
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
                  className={
                    id === "create"
                      ? "flex h-11 w-11 -translate-y-1 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : `flex h-8 w-10 items-center justify-center rounded-lg transition-colors ${
                          isActive ? "bg-primary/10" : "bg-transparent"
                        }`
                  }
                >
                  <Icon
                    size={id === "create" ? 22 : 20}
                    strokeWidth={id === "create" ? 2.5 : isActive ? 2.5 : 2}
                    fill={isActive && id === "matches" ? "currentColor" : "none"}
                    aria-hidden="true"
                    className={id === "create" ? "text-white" : undefined}
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

      {showCreateHub ? (
        <Suspense fallback={null}>
          <CreateHubSheet
        open={showCreateHub}
        onClose={() => setShowCreateHub(false)}
        onSelect={(action: CreateHubAction) => {
          setShowCreateHub(false)
          try {
            if (action === "community") {
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "communities" }))
              window.dispatchEvent(new CustomEvent("ghc:open-community-compose", { detail: {} }))
            } else if (action === "poll") {
              setPollOpen(true)
            } else if (action === "challenge") {
              setChallengeOpen(true)
            } else {
              // Unified post: text + photo + video + files in one composer
              window.dispatchEvent(
                new CustomEvent("ghc:open-compose", {
                  detail: { mode: "post" },
                })
              )
            }
          } catch { /* */ }
        }}
      />
        </Suspense>
      ) : null}

      {pollOpen ? (
        <Suspense fallback={null}>
          <PollComposer open={pollOpen} onOpenChange={setPollOpen} />
        </Suspense>
      ) : null}
      {challengeOpen ? (
        <Suspense fallback={null}>
          <ChallengeComposer open={challengeOpen} onOpenChange={setChallengeOpen} />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
      <MatchCelebrationLazy
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
      </Suspense>

      <div className="pointer-events-none fixed inset-x-0 bottom-[var(--gh-bottom-content-inset)] z-40 mx-auto flex max-w-[var(--gh-content-max,28rem)] flex-col items-center gap-2 px-3">
        {visibleToasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
    </div>
    </ConsentGate>
    </>
  )
}
