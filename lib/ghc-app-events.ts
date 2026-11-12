/**
 * Canonical browser CustomEvent names used across GreenHaven surfaces.
 * Keep this list authoritative so screens do not invent ad-hoc event strings.
 */
export const GHC_APP_EVENTS = {
  WALLET_REFRESH: "ghc:wallet-refresh",
  WALLET_SYNCED: "ghc:wallet-synced",
  DAILY_REWARD_CLAIMED: "ghc:daily-reward-claimed",
  OPEN_DAILY_CLAIM: "ghc:open-daily-claim",
  OPEN_REWARDS: "ghc:open-rewards",
  OPEN_SETTINGS_SECTION: "ghc:open-settings-section",
  MEMBERSHIP_ACTIVATED: "ghc:membership-activated",
  PAYMENT_RECOVERED: "ghc:payment-recovered",
  PAYMENT_UPDATED: "ghc:payment-updated",
  PAYMENT_FULFILLED: "ghc:payment-fulfilled",
  TOAST: "ghc:toast",
  POST_ENGAGEMENT: "ghc:post-engagement",
  NOTIFICATIONS_CHANGED: "ghc:notifications-changed",
} as const

export type GhcAppEventName = (typeof GHC_APP_EVENTS)[keyof typeof GHC_APP_EVENTS]

export function emitGhcAppEvent(name: GhcAppEventName, detail?: unknown) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(name, detail === undefined ? undefined : { detail }))
  } catch {
    /* non-browser */
  }
}
