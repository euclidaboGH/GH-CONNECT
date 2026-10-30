"use client"

import { incomingRequestBadgeCount } from "@/lib/domains/adapters/connection-connect-flow"
import { IdentityService } from "@/lib/identity/identity-service"
import { captureReferralCodeFromLocation, flushPendingReferralAttribution } from "@/lib/referral/capture-ref"
import { notificationSystem, NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications"
import { APP_RELEASE_VERSION, APP_RELEASE_SUMMARY } from "@/lib/app-release"

import { useState, useCallback, useMemo, memo, useEffect, lazy, Suspense, startTransition, type ReactNode, type UIEvent } from "react"
import { useGHCShell, useGHCProfile, useGHCDiscovery, useGHCMessaging } from "@/contexts/ghc-context"
import type { Candidate } from "@/lib/ghc-types"
import { usePiAuth } from "@/contexts/pi-auth-context"
import { Compass, Heart, MessagesSquare, Newspaper, Plus, ShoppingBag, ShoppingCart, UserRound, Users, Wallet } from "lucide-react"
import { ErrorBoundary } from "@/lib/error-boundary"
import { toUserFacingError } from "@/lib/user-facing-error"
import { ConsentGate } from "./consent-gate"
import { BrandLogo } from "./brand-logo"
import { ThemeApplier } from "./theme-applier"
import { OfflineBanner } from "./offline-banner"
import { DailyClaimPrompt } from "./daily-claim-prompt"
import { SkipToContent } from "./skip-to-content"
import { AccessibilityAnnouncer } from "./accessibility-announcer"
import { SessionResumeToast } from "./session-resume-toast"
import { NetworkStatusStrip } from "./network-status-strip"
import { GlobalHotkeys } from "./global-hotkeys"
import { PaymentRecoveryListener } from "./payment-recovery-listener"
import { afterFirstPaint } from "@/lib/mobile-performance"
import { closeAllActionSheets } from "./action-sheet"
import { dispatchCloseTransientUI } from "@/lib/transient-ui"
import type { CreateHubAction } from "./create-hub-sheet"
import { PRIMARY_TABS, resolveDestination, isPrimaryTab } from "@/lib/navigation/destinations"
import { navigateTo } from "@/lib/navigation/navigate"
import { resolveUiOnboardingGate } from "@/lib/onboarding-local"
import { CreatorStudioOverlay } from "./creator-studio-overlay"
import ProfileStorySection from "./profile-story-section"
import { PostComposer } from "./post-composer"
import { socialGetProfile } from "@/lib/social/client"

const CreateHubSheet = lazy(() =>
  import("./create-hub-sheet").then((m) => ({ default: m.CreateHubSheet }))
)
const ShortVideoScreen = lazy(() =>
  import("./short-video-screen").then((m) => ({ default: m.ShortVideoScreen }))
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
  import("./settings").then((m) => ({ default: m.SettingsScreen }))
)
const PremiumWalletScreen = lazy(() =>
  import("@/features/wallet").then((m) => ({ default: m.PremiumWalletScreen }))
)
const GreenHavenEcosystemLazy = lazy(() =>
  import("./greenhaven-ecosystem-screen").then((m) => ({ default: m.GreenHavenEcosystemScreen }))
)
const MarketplaceScreenLazy = lazy(() =>
  import("./marketplace-screen").then((m) => ({ default: m.MarketplaceScreen }))
)
const MatchCelebrationLazy = lazy(() =>
  import("./match-celebration").then((m) => ({ default: m.MatchCelebration }))
)
const ProfilePreviewPageLazy = lazy(() =>
  import("./profile-preview-page").then((m) => ({ default: m.ProfilePreviewPage }))
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
          <div className="gh-brand-loading-blink flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-card/90 p-1.5" aria-hidden="true">
            <img src="/gh-connect-logo.png" alt="" className="h-full w-full object-contain" width={36} height={36} />
          </div>
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
  const isError = type === "error"
  const isSuccess = type === "success"
  const shell =
    isSuccess
      ? "border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-50"
      : isError
        ? "border-destructive/30 bg-destructive text-destructive-foreground"
        : "border-sky-200/80 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-50"
  const dot =
    isSuccess ? "bg-emerald-500" : isError ? "bg-white/90" : "bg-sky-500"

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`pointer-events-auto flex max-w-full items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left shadow-lg shadow-black/10 backdrop-blur-md ${shell}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug tracking-tight">{message}</p>
    </div>
  )
})

Toast.displayName = "Toast"

// Memoized navigation items to prevent recalculation
/** Primary destinations only — secondary (Wallet, Rewards, Communities, Matches…) live under Profile */
const NAV_ITEMS = [
  { id: "home", icon: Newspaper, label: "Home" },
  { id: "messages", icon: MessagesSquare, label: "Messages" },
  { id: "communities", icon: Users, label: "Communities" },
  { id: "cart", icon: ShoppingCart, label: "Cart" },
  { id: "profile", icon: UserRound, label: "Profile" },
] as const

/** Keyboard + deep-link still support secondary tabs */
const NAV_IDS = PRIMARY_TABS

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
  const { ready, tab, setTab, toasts, addToast, matchCelebration, dismissMatchCelebration, startConversation } = useGHCShell()
  const { profile } = useGHCProfile()
  const { candidates, following, matches, swipe, followUser, reportUser, blockUser } = useGHCDiscovery()
  const { conversations } = useGHCMessaging()
  const [peerProfile, setPeerProfile] = useState<Candidate | null>(null)
  const { onboardingStatus: piOnboardingStatus, authLifecycle } = usePiAuth()
  const [connectionRequestBadge, setConnectionRequestBadge] = useState<number>(0)
  const [socialAttentionCount, setSocialAttentionCount] = useState(0)
  const [economyAttentionCount, setEconomyAttentionCount] = useState(0)
  const unreadMessageCount = useMemo(() => (Array.isArray(conversations) ? conversations : []).reduce(
    (count, conversation) => count + (typeof (conversation as { unreadCount?: number }).unreadCount === "number"
      ? Math.max(0, Number((conversation as { unreadCount?: number }).unreadCount) || 0)
      : conversation.unread ? 1 : 0), 0), [conversations])
  const unreadGroupCount = useMemo(() => (Array.isArray(conversations) ? conversations : []).reduce(
    (count, conversation) => count + (conversation.conversationType === "group" &&
      (conversation.unread || Number((conversation as { unreadCount?: number }).unreadCount || 0) > 0) ? 1 : 0), 0), [conversations])

  // Section attention indicators use authenticated server counts plus local in-app
  // alerts. Polling and event-driven refresh cover new activity without requiring a tap.
  const refreshSectionAttention = useCallback(async () => {
    const [socialResponse, economyResponse] = await Promise.all([
      fetch("/api/social/notifications?countOnly=1", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } }).catch(() => null),
      fetch("/api/economy/notifications/unread-count", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } }).catch(() => null),
    ])
    const [social, economy] = await Promise.all([
      socialResponse?.json().catch(() => ({})) || {},
      economyResponse?.json().catch(() => ({})) || {},
    ]) as [{ ok?: boolean; unreadCount?: number }, { ok?: boolean; count?: number }]
    if (social.ok && typeof social.unreadCount === "number") setSocialAttentionCount(Math.max(0, social.unreadCount))
    if (economy.ok && typeof economy.count === "number") setEconomyAttentionCount(Math.max(0, economy.count))
  }, [])

  // Invite links: capture ?ref= and attribute once session is ready
  useEffect(() => {
    try {
      captureReferralCodeFromLocation()
    } catch {
      /* */
    }
  }, [])

  useEffect(() => {
    const uid = String(profile?.id || IdentityService.getCurrentUserId() || "").trim()
    if (!uid) return
    void flushPendingReferralAttribution(() => IdentityService.getAuthHeaders?.() || {})
  }, [profile?.id])

  useEffect(() => {
    void refreshSectionAttention()
    const timer = window.setInterval(() => void refreshSectionAttention(), 15_000)
    const onAttention = () => void refreshSectionAttention()
    const onVisible = () => { if (document.visibilityState === "visible") void refreshSectionAttention() }
    window.addEventListener("focus", onAttention)
    window.addEventListener("online", onAttention)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onAttention as EventListener)
    window.addEventListener("ghc:notification", onAttention)
    window.addEventListener("ghc:new-message", onAttention)
    window.addEventListener("ghc:post-engagement", onAttention)
    window.addEventListener("ghc:daily-reward-claimed", onAttention)
    window.addEventListener("ghc:community-updated", onAttention)
    window.addEventListener("ghc:notifications-read", onAttention)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", onAttention)
      window.removeEventListener("online", onAttention)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onAttention as EventListener)
      window.removeEventListener("ghc:notification", onAttention)
      window.removeEventListener("ghc:new-message", onAttention)
      window.removeEventListener("ghc:post-engagement", onAttention)
      window.removeEventListener("ghc:daily-reward-claimed", onAttention)
      window.removeEventListener("ghc:community-updated", onAttention)
      window.removeEventListener("ghc:notifications-read", onAttention)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refreshSectionAttention])

  useEffect(() => {
    if (!ready) return
    const userId = String(profile?.id || IdentityService.getCurrentUserId() || "").trim()
    if (!userId || userId === "current-user" || userId === "anonymous") return
    try {
      const key = `ghc:last-seen-release:${userId}`
      const previousVersion = window.localStorage.getItem(key)
      if (!previousVersion) {
        // First visit on this device: establish a baseline without generating noise.
        window.localStorage.setItem(key, APP_RELEASE_VERSION)
        return
      }
      if (previousVersion !== APP_RELEASE_VERSION) {
        notificationSystem.addNotification(
          "system",
          "GreenHaven has been updated",
          APP_RELEASE_SUMMARY,
          "✨",
          {
            dedupeKey: `app-release:${APP_RELEASE_VERSION}:${userId}`,
            open: "home",
            section: "updates",
            releaseVersion: APP_RELEASE_VERSION,
          },
        )
        window.localStorage.setItem(key, APP_RELEASE_VERSION)
      }
    } catch {
      // Release notices are best-effort and never block app startup.
    }
  }, [ready, profile?.id])

  useEffect(() => {
    const refresh = () => {
      try {
        setConnectionRequestBadge(incomingRequestBadgeCount(IdentityService.getCurrentUserId()))
      } catch {
        setConnectionRequestBadge(0)
      }
    }
    refresh()
    const id = window.setInterval(refresh, 8000)
    window.addEventListener("ghc:open-connection-inbox", refresh)
    window.addEventListener("ghc:connection-inbox-updated", refresh)
    window.addEventListener("ghc:social-mutation", refresh)
    window.addEventListener("ghc:connection-updated", refresh)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("ghc:open-connection-inbox", refresh)
      window.removeEventListener("ghc:connection-inbox-updated", refresh)
      window.removeEventListener("ghc:social-mutation", refresh)
      window.removeEventListener("ghc:connection-updated", refresh)
    }
  }, [])

  // Content queues (posts/stories/listings/deletes) — single-flight on reconnect.
  useEffect(() => {
    if (typeof window === "undefined") return
    const run = () => {
      void import("@/lib/offline/reconnect-flush")
        .then((m) => m.runReconnectFlush())
        .catch(() => {})
    }
    const onVis = () => {
      if (document.visibilityState === "visible") run()
    }
    window.addEventListener("online", run)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("online", run)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])


  // One canonical peer-profile entry point for cards, messages, matches and notifications.
  // The profile data is sourced from the authenticated discovery context; unknown IDs fail visibly.
  useEffect(() => {
    const openProfile = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: unknown; id?: unknown }>).detail
      const userId = String(detail?.userId || detail?.id || "").trim()
      if (!userId) return
      if (userId === String(profile?.id || "")) {
        startTransition(() => setTab("profile"))
        return
      }
      const local = (Array.isArray(candidates) ? candidates : []).find((item) => String(item.id) === userId)
      if (local) {
        setPeerProfile(local)
        return
      }
      // Profiles opened from Wallet/Activity/Notifications/Messaging must not depend
      // on the current discovery result set. Hydrate the canonical public projection.
      void socialGetProfile(userId).then((result) => {
        if (!result.ok || !result.profile) {
          addToast(result.error === "PROFILE_PRIVATE" ? "This profile is private." : "This profile is not available.", "info")
          return
        }
        const row = result.profile
        const photos = Array.isArray(row.photos) ? row.photos.map(String).filter(Boolean) : []
        const city = String(row.city || "").trim()
        const country = String(row.country || "").trim()
        const hydrated: Candidate = {
          id: userId,
          name: String(row.displayName || row.username || "Member"),
          age: Math.max(18, Number(row.age) || 18),
          location: [city, country].filter(Boolean).join(", ") || "Global",
          bio: String(row.bio || ""),
          photo: photos[0] || "",
          photos,
          coverPhoto: row.coverPhoto ? String(row.coverPhoto) : null,
          interests: Array.isArray(row.interests) ? row.interests.map(String).filter(Boolean) : [],
          verified: Boolean(row.verified || row.isVerified),
          online: Boolean(row.online || row.isOnline),
          lastSeen: Number(row.lastActiveAt) || 0,
          city: city || undefined, country: country || undefined,
          profession: row.profession ? String(row.profession) : undefined,
          education: row.education ? String(row.education) : undefined,
          primaryMode: row.primaryMode ? String(row.primaryMode) : undefined,
          joinedAt: typeof row.createdAt === "number" || typeof row.createdAt === "string" ? row.createdAt : undefined,
          isSample: false,
        }
        setPeerProfile(hydrated)
      }).catch(() => addToast("This profile could not be loaded right now.", "error"))
    }
    window.addEventListener("ghc:open-profile", openProfile as EventListener)
    return () => window.removeEventListener("ghc:open-profile", openProfile as EventListener)
  }, [candidates, profile?.id, setTab, addToast])

  // Deep links: primary tabs and canonical overlay destinations. Keep unrelated
  // query parameters/hash intact (e.g. referral attribution and shared content).
  // Overlay dispatch is deferred one task so the shell's event listeners have mounted.
  useEffect(() => {
    if (!ready || typeof window === "undefined") return
    let overlayTimer: number | undefined
    try {
      const url = new URL(window.location.href)
      const requested = url.searchParams.get("tab")
      if (!requested) return
      const destination = resolveDestination(requested)
      if (destination && isPrimaryTab(destination)) {
        startTransition(() => setTab(destination))
      } else if (destination) {
        overlayTimer = window.setTimeout(() => { navigateTo(destination) }, 0)
      }
      // Invalid destinations are discarded rather than left to repeatedly reopen.
      url.searchParams.delete("tab")
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
    } catch {
      /* malformed URLs must not interrupt app startup */
    }
    return () => { if (overlayTimer !== undefined) window.clearTimeout(overlayTimer) }
  }, [ready, setTab])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    | "main"
    | "wallet"
    | "rewards"
    | "membership"
    | "help"
    | "privacy"
    | "notifications"
    | "appearance"
    | "device-lock"
  >("main")
  /** Direct GHC Wallet overlay — not nested under Settings */
  const [walletOpen, setWalletOpen] = useState(false)
  const [showCreateHub, setShowCreateHub] = useState(false)
  const [showGlobalComposer, setShowGlobalComposer] = useState(false)
  const [globalComposeMode, setGlobalComposeMode] = useState<"post" | "story">("post")
  const [showShortVideo, setShowShortVideo] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [ecosystemOpen, setEcosystemOpen] = useState(false)
  /** Service id to focus when Ecosystem opens (e.g. marketplace) */
  const [ecosystemFocus, setEcosystemFocus] = useState<string | null>(null)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [marketplaceListingId, setMarketplaceListingId] = useState<string | null>(null)
  /** Auto-hide bottom nav while scrolling down; reveal on scroll-up or tap */
  const [bottomNavHidden, setBottomNavHidden] = useState(false)
  useEffect(() => {
    const onTyping = (e: Event) => {
      const detail = (e as CustomEvent<{ active?: boolean }>).detail
      setBottomNavHidden(Boolean(detail?.active))
    }
    window.addEventListener("ghc:message-typing", onTyping as EventListener)
    return () => window.removeEventListener("ghc:message-typing", onTyping as EventListener)
  }, [])

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
    setMarketplaceOpen(false)
    setWalletOpen(true)
    setShowCreateHub(false)
    setBottomNavHidden(false)
    try { window.dispatchEvent(new CustomEvent("ghc:close-compose")) } catch { /* */ }
  }, [])
  const closeWallet = useCallback(() => {
    setWalletOpen(false)
  }, [])
  useEffect(() => {
    const openEco = (e: Event) => {
      const detail = (e as CustomEvent).detail
      let focus: string | null = null
      if (detail && typeof detail === "object" && typeof (detail as { focus?: unknown }).focus === "string") {
        const raw = String((detail as { focus: string }).focus).trim().toLowerCase()
        focus = raw || null
      }
      setSettingsOpen(false)
      setSettingsInitialSection("main")
      setWalletOpen(false)
      setMarketplaceOpen(false)
      setShowCreateHub(false)
      setBottomNavHidden(false)
      setEcosystemFocus(focus)
      setEcosystemOpen(true)
    }
    window.addEventListener("ghc:open-ecosystem", openEco)
    const openMarketplace = (e: Event) => {
      const detail = (e as CustomEvent).detail
      let listingId: string | null = null
      if (detail && typeof detail === "object" && typeof (detail as { listingId?: unknown }).listingId === "string") {
        listingId = String((detail as { listingId: string }).listingId).trim() || null
      }
      setSettingsOpen(false)
      setWalletOpen(false)
      setEcosystemOpen(false)
      setShowCreateHub(false)
      setBottomNavHidden(false)
      setMarketplaceListingId(listingId)
      setMarketplaceOpen(true)
    }
    window.addEventListener("ghc:open-marketplace", openMarketplace)
    const openShort = () => setShowShortVideo(true)
    window.addEventListener("ghc:open-short-video", openShort)
    return () => {
      window.removeEventListener("ghc:open-ecosystem", openEco)
      window.removeEventListener("ghc:open-marketplace", openMarketplace)
      window.removeEventListener("ghc:open-short-video", openShort)
    }
  }, [])

  // Deep-links from notifications / identity cards
  useEffect(() => {
    const onWallet = () => openWallet()
    const onRewards = () => openSettings("rewards")
    const onMembership = () => openSettings("membership")
    const onSettings = (e: Event) => {
      const section = (e as CustomEvent).detail?.section
      const allowed = ["main", "wallet", "rewards", "membership", "help", "privacy", "notifications", "appearance", "device-lock"] as const
      const s = allowed.includes(section) ? section : "main"
      openSettings(s)
    }
    const onStartChat = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      const userId = String(d.userId || "").trim()
      const userName = String(d.userName || d.name || d.displayName || "Pioneer").trim()
      const userPhoto = String(d.userPhoto || d.photo || d.avatar || "").trim()
      if (userId && startConversation) {
        try {
          void startConversation(userId, userName || "Pioneer", userPhoto || "")
        } catch {
          /* */
        }
      }
      startTransition(() => setTab("messages"))
    }
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<{ message?: string; type?: string }>).detail || {}
      const msg = String(d.message || "").trim()
      if (!msg) return
      try {
        const t = (d.type === "success" || d.type === "error" || d.type === "info") ? d.type : "info"
        addToast(msg, t)
      } catch { /* */ }
    }
    window.addEventListener("ghc:toast", onToast)
    window.addEventListener("ghc:open-wallet", onWallet)
    window.addEventListener("ghc:open-rewards", onRewards)
    window.addEventListener("ghc:open-membership", onMembership)
    window.addEventListener("ghc:open-settings", onSettings)
    window.addEventListener("ghc:start-chat", onStartChat)
    // Ensure Communities tab mounts before community deep-link is applied
    const onOpenCommunity = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      const groupId = String(d.groupId || d.id || "").trim()
      startTransition(() => setTab("communities"))
      if (!groupId) return
      window.setTimeout(() => {
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:open-community", { detail: { groupId } })
          )
        } catch {
          /* */
        }
      }, 80)
    }
    // Use capture-free secondary event from navigateTo; direct open-community
    // still works when communities is already mounted (communities-screen listener).
    window.addEventListener("ghc:ensure-community-tab", onOpenCommunity)
    return () => {
      window.removeEventListener("ghc:toast", onToast)
      window.removeEventListener("ghc:open-wallet", onWallet)
      window.removeEventListener("ghc:open-rewards", onRewards)
      window.removeEventListener("ghc:open-membership", onMembership)
      window.removeEventListener("ghc:open-settings", onSettings)
      window.removeEventListener("ghc:start-chat", onStartChat)
      window.removeEventListener("ghc:ensure-community-tab", onOpenCommunity)
    }
  }, [openWallet, openSettings, startConversation, setTab, addToast])
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
    setEcosystemFocus(null)
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
    const onOpenCompose = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: unknown }>).detail || {}
      const mode = detail.mode === "story" ? "story" : "post"
      setGlobalComposeMode(mode)
      setShowGlobalComposer(true)
    }
    const onCloseCompose = () => setShowGlobalComposer(false)
    window.addEventListener("ghc:open-create-hub", onCreateHub)
    window.addEventListener("ghc:open-compose", onOpenCompose as EventListener)
    window.addEventListener("ghc:close-compose", onCloseCompose)
    const onPoll = () => setPollOpen(true)
    const onChallenge = () => setChallengeOpen(true)
    window.addEventListener("ghc:open-poll", onPoll)
    window.addEventListener("ghc:open-challenge", onChallenge)
    return () => {
      window.removeEventListener("ghc:bottom-nav-visibility", onVis)
      window.removeEventListener("ghc:open-create-hub", onCreateHub)
      window.removeEventListener("ghc:open-compose", onOpenCompose as EventListener)
      window.removeEventListener("ghc:close-compose", onCloseCompose)
      window.removeEventListener("ghc:open-poll", onPoll)
      window.removeEventListener("ghc:open-challenge", onChallenge)
    }
  }, [])

  // Cross-screen post routing: Profile/notifications can request a post even when
  // the Feed screen is currently unmounted. Move to Home first, then replay the
  // request after the feed has mounted. This prevents lost synchronous events.
  useEffect(() => {
    const onOpenPost = (event: Event) => {
      const detail = (event as CustomEvent<{ postId?: unknown; action?: unknown }>).detail || {}
      const postId = typeof detail.postId === "string" ? detail.postId.trim() : ""
      if (!postId) return
      const action = detail.action === "comment" || detail.action === "share" || detail.action === "insights" ? detail.action : undefined
      startTransition(() => setTab("home"))
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ghc:open-post-ready", { detail: { postId, action } }))
      }, 180)
    }
    window.addEventListener("ghc:open-post", onOpenPost as EventListener)
    return () => window.removeEventListener("ghc:open-post", onOpenPost as EventListener)
  }, [setTab])

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
      // Use Window typing explicitly — `in` narrowing can yield never on window.setTimeout
      const w: Window = window
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(warm, { timeout: 1800 })
      } else {
        w.setTimeout(warm, 400)
      }
      w.setTimeout(() => {
        void import("./settings")
        void import("@/features/wallet")
      }, 2200)
    })
  }, [])

  useEffect(() => {
    const resolveTab = (detail: unknown): string | null => {
      if (typeof detail === "string" && detail.trim()) return detail.trim()
      if (detail && typeof detail === "object" && "tab" in (detail as object)) {
        const t = (detail as { tab?: unknown }).tab
        if (typeof t === "string" && t.trim()) return t.trim()
      }
      return null
    }
    const handleNavigate = (event: Event) => {
      const raw = resolveTab((event as CustomEvent).detail)
      if (!raw) return
      const dest = resolveDestination(raw) || raw
      // Primary tabs → shell tab state
      if (isPrimaryTab(dest)) {
        startTransition(() => setTab(dest))
        return
      }
      // Overlays / aliases (wallet, marketplace, rewards, …)
      navigateTo(dest)
    }
    // Canonical event (string detail) + legacy object detail { tab }
    window.addEventListener("ghc:navigate-tab", handleNavigate)
    window.addEventListener("ghc:navigate", handleNavigate)
    return () => {
      window.removeEventListener("ghc:navigate-tab", handleNavigate)
      window.removeEventListener("ghc:navigate", handleNavigate)
    }
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

  // Onboarding gate — server + local profile authority.
  // Never treat hydration "unknown" as "required".
  // Returning users with a completed local profile must not see registration after PIN unlock.
  const effectiveOnboardingRaw = resolveUiOnboardingGate({
    profile,
    piOnboardingStatus: piOnboardingStatus || "unknown",
    serverVerified: Boolean(authLifecycle?.serverVerified),
    userId:
      (profile as { id?: string } | null | undefined)?.id ||
      authLifecycle?.ghUserId ||
      authLifecycle?.piUid ||
      null,
    username:
      (profile as { username?: string } | null | undefined)?.username ||
      (profile as { displayName?: string } | null | undefined)?.displayName ||
      null,
    candidateUserIds: [
      (profile as { id?: string } | null | undefined)?.id,
      authLifecycle?.ghUserId,
      authLifecycle?.piUid,
    ],
  })
  // Authoritative gate only — never timeout-force registration for returning users
  const effectiveOnboarding = effectiveOnboardingRaw

  if (effectiveOnboarding === "unavailable") {
    return (
      <>
        {themeLayer}
        <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[#050a08] px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.12)_0%,transparent_60%)]" />
          <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
            <p className="text-sm font-semibold tracking-wide text-red-300/90">Identity service unavailable</p>
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">
              GreenHaven could not load your account securely. This is a server configuration issue, not a new-user state.
              Please try again in a moment. If it continues, contact support.
            </p>
            <button
              type="button"
              className="mt-6 rounded-full bg-emerald-600/90 px-5 py-2 text-sm font-medium text-white"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </>
    )
  }

  if (effectiveOnboarding === "unknown") {
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
            <p className="mt-1 text-[11px] text-white/40">Confirming your GreenHaven identity…</p>
          </div>
        </div>
      </>
    )
  }

  if (effectiveOnboarding === "required") {
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

  if (marketplaceOpen) {
    return (
      <>
        {themeLayer}
        <ConsentGate>
          <div className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-[var(--gh-content-max,28rem)] mx-auto relative w-full">
            <ScreenBoundary
              label="Marketplace"
              onDismiss={() => {
                setMarketplaceOpen(false)
                setMarketplaceListingId(null)
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<TabScreenFallback label="Marketplace" />}>
                  <MarketplaceScreenLazy
                    onBack={() => {
                      setMarketplaceOpen(false)
                      setMarketplaceListingId(null)
                    }}
                    initialListingId={marketplaceListingId}
                  />
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
              onDismiss={() => {
                setEcosystemOpen(false)
                setEcosystemFocus(null)
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<TabScreenFallback label="Ecosystem" />}>
                  <GreenHavenEcosystemLazy
                    onBack={() => {
                      setEcosystemOpen(false)
                      setEcosystemFocus(null)
                    }}
                    initialFocus={ecosystemFocus}
                  />
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
    <SkipToContent />
    <AccessibilityAnnouncer label={NAV_ITEMS.find((item) => item.id === activeTab)?.label || "GreenHaven"} />
    <GlobalHotkeys />
    <div
      className="gh-app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground max-w-[var(--gh-content-max,28rem)] mx-auto relative w-full"
      data-nav-hidden={bottomNavHidden ? "true" : "false"}
      data-nav-in-flow="true"
    >
      <DailyClaimPrompt />
      <OfflineBanner />
      <PaymentRecoveryListener />
      {/* Main content — tap reveals bottom nav when it was auto-hidden */}
      <main
        id="ghc-main-content"
        tabIndex={-1}
        aria-label="GreenHaven main content"
        className="relative z-0 min-h-0 flex-1 overflow-hidden bg-background"
        onPointerDown={() => {
          if (bottomNavHidden) setBottomNavHidden(false)
        }}
      >
        {/* Content fills the flex area above the nav. Modest pb only for last-item breathing room. */}
        {visitedTabs.has("home") && (
        <div aria-hidden={activeTab !== "home"} className="gh-tab-panel absolute inset-0 transition-opacity duration-200 ease-out" style={{ opacity: activeTab === "home" ? 1 : 0, pointerEvents: activeTab === "home" ? "auto" : "none", contentVisibility: activeTab === "home" ? "visible" : "hidden", contain: "layout paint style" }}>
          <div className="h-full min-h-0 overflow-hidden" onScrollCapture={onTabScrollHideNav}>
            <ScreenBoundary label="Feed" onReset={() => resetScreen("home")}>
              <Suspense fallback={<TabScreenFallback label="Feed" />}>
                <EnhancedFeedScreen key={screenResetKeys.home || 0} onCompose={() => setShowCreateHub(true)} />
              </Suspense>
            </ScreenBoundary>
          </div>
        </div>
        )}
        {visitedTabs.has("discover") && (
        <div className="gh-tab-panel absolute inset-0 transition-opacity duration-200 ease-out" style={{ opacity: activeTab === "discover" ? 1 : 0, pointerEvents: activeTab === "discover" ? "auto" : "none", contentVisibility: activeTab === "discover" ? "visible" : "hidden", contain: "layout paint style" }}>
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
        <div className="gh-tab-panel absolute inset-0 transition-opacity duration-200 ease-out" style={{ opacity: activeTab === "matches" ? 1 : 0, pointerEvents: activeTab === "matches" ? "auto" : "none", contentVisibility: activeTab === "matches" ? "visible" : "hidden", contain: "layout paint style" }}>
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
        <div className="gh-tab-panel absolute inset-0 transition-opacity duration-200 ease-out" style={{ opacity: activeTab === "communities" ? 1 : 0, pointerEvents: activeTab === "communities" ? "auto" : "none", contentVisibility: activeTab === "communities" ? "visible" : "hidden", contain: "layout paint style" }}>
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
        <div className="gh-tab-panel absolute inset-0 transition-opacity duration-200 ease-out" style={{ opacity: activeTab === "messages" ? 1 : 0, pointerEvents: activeTab === "messages" ? "auto" : "none", contentVisibility: activeTab === "messages" ? "visible" : "hidden", contain: "layout paint style" }}>
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
        <div className="gh-tab-panel absolute inset-0 transition-opacity duration-200 ease-out" style={{ opacity: activeTab === "profile" ? 1 : 0, pointerEvents: activeTab === "profile" ? "auto" : "none", contentVisibility: activeTab === "profile" ? "visible" : "hidden", contain: "layout paint style" }}>
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

      {/* Global composer: mounted at app-shell level so Profile, Home,
          notifications and other screens can open the same durable composer. */}
      <PostComposer
        open={showGlobalComposer}
        onOpenChange={setShowGlobalComposer}
        initialMode={globalComposeMode}
      />

      {/* Bottom navigation — fixed to bottom edge so main can use full height.
          Auto-hides on scroll-down (translate off-screen); tap or scroll-up reveals.
          Hairline border only — no heavy shadow overlay. */}
      <nav
        className={`gh-bottom-nav relative z-40 flex w-full shrink-0 items-end border-t border-border/50 bg-card/95 backdrop-blur-md px-1 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-1 transition-[max-height,opacity,transform] duration-200 ease-out sm:px-2 ${
          bottomNavHidden || showCreateHub ? "max-h-0 overflow-hidden opacity-0 pointer-events-none border-transparent" : "max-h-[4.75rem] opacity-100"
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
            const isActive = id === "cart" ? marketplaceOpen : activeTab === id
            return (
              <button
                key={id}
                type="button"
                onPointerDown={() => {
                  if (id === "cart" || !isPrimaryTab(id as any)) return
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:prefetch-tab", { detail: id }))
                  } catch { /* */ }
                }}
                onClick={() => {
                  // Cart is the commerce checkout surface (orders + pay), not Market browse.
                  if (id === "cart") {
                    setMarketplaceOpen(true)
                    try {
                      window.dispatchEvent(
                        new CustomEvent("ghc:open-marketplace", {
                          detail: { bucket: "orders", source: "bottom-cart" },
                        }),
                      )
                    } catch { /* */ }
                    return
                  }
                  if (isActive) {
                    if (id === "home" && connectionRequestBadge > 0) {
                      try {
                        window.dispatchEvent(new CustomEvent("ghc:open-notifications", { detail: { filter: "connections" } }))
                      } catch { /* */ }
                    }
                    scrollActiveTabToTop()
                    return
                  }
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: id }))
                  } catch {
                    /* */
                  }
                  if (isPrimaryTab(id)) {
                    startTransition(() => setTab(id))
                  }
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
                    (id as string) === "create"
                      ? "gh-create-fab flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full text-white"
                      : `flex h-8 w-10 items-center justify-center rounded-lg transition-colors ${
                          isActive ? "bg-primary/10" : "bg-transparent"
                        }`
                  }
                >
                  <span className="relative inline-flex">
                    <Icon
                      size={(id as string) === "create" ? 22 : 20}
                      strokeWidth={(id as string) === "create" ? 2.5 : isActive ? 2.5 : 2}
                      fill="none"
                      aria-hidden="true"
                      className={(id as string) === "create" ? "text-white" : undefined}
                    />
                    {((id === "home" && connectionRequestBadge > 0) ||
                      (id === "messages" && unreadMessageCount > 0) ||
                      (id === "communities" && unreadGroupCount > 0) ||
                      (id === "profile" && economyAttentionCount > 0)) ? (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-card"
                        aria-label="New activity"
                        title="New activity — open this section to review"
                      />
                    ) : null}
                  </span>
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
            } else if (action === "story") {
              window.dispatchEvent(new CustomEvent("ghc:open-story-creator"))
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
      {showShortVideo && (
        <Suspense fallback={null}>
          <ShortVideoScreen open={showShortVideo} onClose={() => setShowShortVideo(false)} />
        </Suspense>
      )}
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
          setTab("discover")
        }}
        onMessage={() => {
          const id = matchCelebration?.userId
          const name = matchCelebration?.userName || "Match"
          const photo = matchCelebration?.userPhoto || ""
          dismissMatchCelebration?.()
          if (id) {
            void startConversation?.(id, name, photo)
            setTab("messages")
            try {
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
            } catch {
              /* */
            }
          }
        }}
      />
      </Suspense>

      {peerProfile ? (
        <Suspense fallback={null}>
          <ProfilePreviewPageLazy
            candidate={peerProfile}
            userInterests={Array.isArray(profile?.interests) ? profile.interests : []}
            onBack={() => setPeerProfile(null)}
            onMessage={() => {
              const target = peerProfile
              void startConversation(target.id, target.name, target.photo).then(() => {
                setPeerProfile(null)
                startTransition(() => setTab("messages"))
              }).catch(() => addToast("Could not open this conversation. Please try again.", "error"))
            }}
            onLike={() => { void swipe(peerProfile.id, "like").catch(() => addToast("Could not send interest. Please try again.", "error")) }}
            onPass={() => { void swipe(peerProfile.id, "pass").then(() => setPeerProfile(null)).catch(() => addToast("Could not update this preference.", "error")) }}
            onFollow={() => {
              const wasFollowing = following.includes(peerProfile.id)
              void followUser(peerProfile.id).then(() => addToast(wasFollowing ? `Unfollowed ${peerProfile.name}` : `Following ${peerProfile.name}`, "success")).catch(() => addToast("Could not update this follow.", "error"))
            }}
            onBlock={() => { void blockUser(peerProfile.id).then(() => { setPeerProfile(null); addToast("Member blocked", "success") }).catch(() => addToast("Could not block this member.", "error")) }}
            onReport={(reason) => { void reportUser(peerProfile.id, reason).then(() => addToast("Report submitted", "success")).catch(() => addToast("Could not submit report.", "error")) }}
            isFollowing={following.includes(peerProfile.id)}
            isMatched={matches.some((item) => item.userId === peerProfile.id || item.id === peerProfile.id)}
          />
        </Suspense>
      ) : null}

      <CreatorStudioOverlay />
      <ProfileStorySection creatorHost />

      <div
        className="gh-toast-host pointer-events-none fixed inset-x-0 bottom-[var(--gh-toast-bottom-inset,var(--gh-fixed-nav-content-inset))] z-[220] mx-auto flex max-w-[var(--gh-content-max,28rem)] flex-col items-center gap-2 px-3 pb-1"
        aria-live="polite"
      >
        <NetworkStatusStrip />
        {visibleToasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
    </div>
    </ConsentGate>
    </>
  )
}
