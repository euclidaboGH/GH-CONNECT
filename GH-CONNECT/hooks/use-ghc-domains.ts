/**
 * Domain hooks for GreenHaven — prefer these over useGHC() on hot screens.
 *
 * useGHCShell      — tab, toasts, online, match celebration (shell chrome)
 * useGHCProfile    — profile, settings, friends, posts (identity)
 * useGHCDiscovery  — candidates, matches, swipe/block
 * useGHCMessaging  — conversations, send, communities
 * useGHCFeed       — posts, stories, like/comment/share (Home)
 * useGHC()         — full bag (legacy / settings only when needed)
 *
 * Splitting reduces cross-tab re-renders: messaging updates no longer
 * force the entire feed tree to reconcile when the feed uses useGHCFeed.
 */
export {
  useGHC,
  useGHCShell,
  useGHCProfile,
  useGHCDiscovery,
  useGHCMessaging,
  useGHCFeed,
  useGHCCommunity,
} from "@/contexts/ghc-context"
