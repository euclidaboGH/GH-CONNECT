/**
 * Canonical window CustomEvent names used across GreenHaven UI shells.
 * Prefer these constants when dispatching/listening so sections stay wired.
 */
export const GHC_APP_EVENTS = {
  toast: "ghc:toast",
  openWallet: "ghc:open-wallet",
  openRewards: "ghc:open-rewards",
  openMembership: "ghc:open-membership",
  openSettings: "ghc:open-settings",
  openSettingsSection: "ghc:open-settings-section",
  openMarketplace: "ghc:open-marketplace",
  openCommunity: "ghc:open-community",
  ensureCommunityTab: "ghc:ensure-community-tab",
  startChat: "ghc:start-chat",
  navigateTab: "ghc:navigate-tab",
  tabChange: "ghc:tab-change",
  walletSynced: "ghc:wallet-synced",
  walletRefresh: "ghc:wallet-refresh",
  utilitySpent: "ghc:utility-spent",
  dailyRewardClaimed: "ghc:daily-reward-claimed",
  membershipActivated: "ghc:membership-activated",
  profileMediaUpdated: "ghc:profile-media-updated",
  marketplaceOrderChanged: "ghc:marketplace-order-changed",
  ghcPackIntent: "ghc:ghc-pack-intent",
  notificationsChanged: "ghc:notifications-changed",
  bottomNavVisibility: "ghc:bottom-nav-visibility",
  closeCompose: "ghc:close-compose",
} as const

export type GhcAppEventName = (typeof GHC_APP_EVENTS)[keyof typeof GHC_APP_EVENTS]
