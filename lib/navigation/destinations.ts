/**
 * Canonical GreenHaven navigation destinations.
 * Single source of truth for tabs, overlays, and deep-link aliases.
 * Do not invent parallel routers — shell (app.tsx) owns presentation.
 *
 * Visible bottom nav (5): Home · Discover · Create · Messages · Profile
 * PRIMARY_TABS still mounts matches + communities for deep-links.
 */

import type { Tab } from "@/lib/ghc-types"

/** Primary shell tabs (mounted in app.tsx for deep-link / keyboard). */
export const PRIMARY_TABS = [
  "home",
  "discover",
  "matches",
  "communities",
  "messages",
  "profile",
] as const satisfies readonly Tab[]

export type PrimaryTab = (typeof PRIMARY_TABS)[number]

/**
 * Visible bottom-bar destinations (Create is an overlay, not a PRIMARY_TAB).
 * Must remain exactly these five product destinations.
 */
export const BOTTOM_NAV_IDS = ["home", "discover", "create", "messages", "profile"] as const

export type OverlayDestination =
  | "wallet"
  | "rewards"
  | "settings"
  | "membership"
  | "help"
  | "ecosystem"
  | "marketplace"
  | "create"

export type DestinationId = PrimaryTab | OverlayDestination

export type DestinationMeta = {
  id: DestinationId
  label: string
  /** tab | overlay | service */
  type: "tab" | "overlay" | "service"
  category: "core" | "social" | "value" | "tools" | "commerce"
  status: "ACTIVE" | "BETA" | "COMING_SOON" | "UNAVAILABLE"
}

/** Structured catalogue for IA clarity (shell still owns presentation). */
export const DESTINATION_CATALOGUE: readonly DestinationMeta[] = [
  { id: "home", label: "Home", type: "tab", category: "core", status: "ACTIVE" },
  { id: "discover", label: "Discover", type: "tab", category: "core", status: "ACTIVE" },
  { id: "matches", label: "Matches", type: "tab", category: "social", status: "ACTIVE" },
  { id: "communities", label: "Communities", type: "tab", category: "social", status: "ACTIVE" },
  { id: "messages", label: "Messages", type: "tab", category: "core", status: "ACTIVE" },
  { id: "profile", label: "Profile", type: "tab", category: "core", status: "ACTIVE" },
  { id: "create", label: "Create", type: "overlay", category: "core", status: "ACTIVE" },
  { id: "wallet", label: "Wallet", type: "overlay", category: "value", status: "ACTIVE" },
  { id: "rewards", label: "Rewards", type: "overlay", category: "value", status: "ACTIVE" },
  { id: "membership", label: "Membership", type: "overlay", category: "value", status: "ACTIVE" },
  { id: "settings", label: "Settings", type: "overlay", category: "tools", status: "ACTIVE" },
  { id: "help", label: "Help", type: "overlay", category: "tools", status: "ACTIVE" },
  { id: "ecosystem", label: "Ecosystem", type: "overlay", category: "tools", status: "ACTIVE" },
  { id: "marketplace", label: "Marketplace", type: "service", category: "commerce", status: "ACTIVE" },
] as const

/**
 * Aliases → canonical id.
 * Marketplace must NOT resolve to discover.
 */
export const DESTINATION_ALIASES: Record<string, DestinationId> = {
  home: "home",
  feed: "home",
  discover: "discover",
  explore: "discover",
  people: "discover",
  find: "discover",
  matches: "matches",
  match: "matches",
  connections: "matches",
  communities: "communities",
  community: "communities",
  groups: "communities",
  group: "communities",
  messages: "messages",
  message: "messages",
  chat: "messages",
  chats: "messages",
  inbox: "messages",
  profile: "profile",
  me: "profile",
  account: "profile",
  wallet: "wallet",
  ghc: "wallet",
  balance: "wallet",
  rewards: "rewards",
  reward: "rewards",
  daily: "rewards",
  settings: "settings",
  preferences: "settings",
  membership: "membership",
  vip: "membership",
  help: "help",
  support: "help",
  ecosystem: "ecosystem",
  eco: "ecosystem",
  marketplace: "marketplace",
  market: "marketplace",
  shop: "marketplace",
  listing: "marketplace",
  create: "create",
  compose: "create",
}

export function resolveDestination(raw: string | null | undefined): DestinationId | null {
  if (!raw || typeof raw !== "string") return null
  const key = raw.trim().toLowerCase()
  if (!key) return null
  return DESTINATION_ALIASES[key] ?? null
}

export function isPrimaryTab(id: string): id is PrimaryTab {
  return (PRIMARY_TABS as readonly string[]).includes(id)
}

export function isOverlay(id: DestinationId): id is OverlayDestination {
  return !isPrimaryTab(id)
}

export function getDestinationMeta(id: DestinationId): DestinationMeta | undefined {
  return DESTINATION_CATALOGUE.find((d) => d.id === id)
}
