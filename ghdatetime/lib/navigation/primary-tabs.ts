/**
 * Phase 2B — mobile primary navigation.
 * Home | Cart | Wallet | Profile
 */
export type PrimaryTabId = "home" | "cart" | "wallet" | "profile"

export const PRIMARY_TABS: Array<{
  id: PrimaryTabId
  label: string
  ariaLabel: string
}> = [
  { id: "home", label: "Home", ariaLabel: "Home feed" },
  { id: "cart", label: "Cart", ariaLabel: "Marketplace cart" },
  { id: "wallet", label: "Wallet", ariaLabel: "Wallet and balances" },
  { id: "profile", label: "Profile", ariaLabel: "Your profile" },
]

/** Secondary destinations — not primary chrome */
export const SECONDARY_DESTINATIONS = [
  "communities",
  "messages",
  "discover",
  "rewards",
  "membership",
  "settings",
  "notifications",
] as const
