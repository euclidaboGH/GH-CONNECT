/**
 * Canonical GreenHaven navigation destinations.
 * Single source of truth for tabs, overlays, and deep-link aliases.
 * Do not invent parallel routers — shell (app.tsx) owns presentation.
 */

import type { Tab } from "@/lib/ghc-types"

/** Primary shell tabs (mounted in app.tsx). */
export const PRIMARY_TABS = [
  "home",
  "discover",
  "matches",
  "communities",
  "messages",
  "profile",
] as const satisfies readonly Tab[]

export type PrimaryTab = (typeof PRIMARY_TABS)[number]

/** Overlay / non-tab surfaces controlled by app.tsx state. */
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

/** Aliases users/feed/cards may emit → canonical id */
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
