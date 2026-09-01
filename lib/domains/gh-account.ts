/**
 * GreenHaven Account Spine — GreenHaven 2.0 product architecture
 *
 * One coherent chain (not isolated modules):
 *
 *   Pi identity
 *     → GreenHaven account (session userId)
 *       → Social identity (profile, discovery, graph)
 *         → GreenHaven ID (public handle / QR / P2P)
 *           → GHC wallet + ledger
 *             → Rewards / XP / streaks
 *               → Membership (Free | VIP | VVIP)
 *                 → Marketplace entitlements
 *                   → Pi payments (U2A / external)
 *
 * UI and domains should read through resolveGreenHavenAccount() instead of
 * stitching Pi / profile / wallet / membership ad hoc in every screen.
 */

import { getOrCreateGreenHavenId, formatGreenHavenIdDisplay } from "./greenhaven-id"
import {
  getMembershipStatus,
  type MembershipTierId,
  type MembershipStatus,
} from "./membership-domain"
import { PI_NETWORK_CONFIG } from "@/lib/system-config"

export type AccountLayerId =
  | "pi"
  | "session"
  | "social"
  | "greenhaven_id"
  | "wallet"
  | "rewards"
  | "membership"
  | "marketplace"
  | "pi_payments"

export interface AccountLayerStatus {
  id: AccountLayerId
  label: string
  ready: boolean
  summary: string
  /** Optional deep-link target inside the app shell */
  open?: "wallet" | "rewards" | "membership" | "profile" | "settings" | "marketplace"
}

export interface GreenHavenAccount {
  /** Canonical session user id (Pi uid when available, else local) */
  userId: string
  /** Pi Network linkage */
  pi: {
    linked: boolean
    uid: string | null
    username: string | null
    appSlug: string
    sandbox: boolean
  }
  /** Social profile surface */
  social: {
    displayName: string
    onboarded: boolean
    verified: boolean
    photo: string | null
    city: string
    country: string
  }
  /** Public GreenHaven ID for receive / QR / mentions */
  greenHavenId: string
  greenHavenIdDisplay: string
  /** Membership */
  membership: MembershipStatus
  membershipLabel: string
  /** Layer checklist for hub UI */
  layers: AccountLayerStatus[]
  /** True when core identity chain is usable */
  ecosystemReady: boolean
}

export interface ResolveAccountInput {
  userId?: string | null
  piUid?: string | null
  piUsername?: string | null
  displayName?: string | null
  onboarded?: boolean
  verified?: boolean
  photo?: string | null
  city?: string | null
  country?: string | null
  /** Wallet available balance if known (display only) */
  ghcAvailable?: number | null
  /** Reward level label if known */
  rewardLevelLabel?: string | null
  /** Whether Pi createPayment is available in this runtime */
  piPaymentsAvailable?: boolean
}

const TIER_LABEL: Record<MembershipTierId, string> = {
  free: "Member",
  vip: "VIP",
  vvip: "VVIP",
}

/**
 * Build the unified account view from current session slices.
 * Pure + side-effect free except GreenHaven ID cache read/write.
 */
export function resolveGreenHavenAccount(input: ResolveAccountInput = {}): GreenHavenAccount {
  const userId =
    String(input.userId || input.piUid || "current-user").trim() || "current-user"
  const piUid = input.piUid?.trim() || null
  const piUsername = input.piUsername?.trim() || null
  const piLinked = Boolean(piUid)

  const displayName =
    (input.displayName || "").trim() || piUsername || "Pioneer"
  const onboarded = Boolean(input.onboarded)
  const verified = Boolean(input.verified)
  const photo = input.photo || null
  const city = (input.city || "").trim()
  const country = (input.country || "").trim()

  const ghId = getOrCreateGreenHavenId(
    userId,
    piUsername || displayName
  )
  const membership = getMembershipStatus(userId)
  const membershipLabel = TIER_LABEL[membership.tier] || membership.tier

  const ghc =
    typeof input.ghcAvailable === "number" && Number.isFinite(input.ghcAvailable)
      ? input.ghcAvailable
      : null
  const rewardLabel = (input.rewardLevelLabel || "").trim() || "Active"
  const paymentsOk = Boolean(input.piPaymentsAvailable)

  const layers: AccountLayerStatus[] = [
    {
      id: "pi",
      label: "Pi identity",
      ready: piLinked,
      summary: piLinked
        ? `@${piUsername || piUid}`
        : "Sign in with Pi Browser for full access",
      open: "settings",
    },
    {
      id: "session",
      label: "GreenHaven account",
      ready: true,
      summary: userId === "current-user" ? "Local session" : userId.slice(0, 16),
      open: "profile",
    },
    {
      id: "social",
      label: "Social identity",
      ready: onboarded && displayName.length > 0,
      summary: onboarded
        ? `${displayName}${city ? ` · ${city}` : ""}`
        : "Finish onboarding to unlock discovery",
      open: "profile",
    },
    {
      id: "greenhaven_id",
      label: "GreenHaven ID",
      ready: Boolean(ghId),
      summary: formatGreenHavenIdDisplay(ghId),
      open: "wallet",
    },
    {
      id: "wallet",
      label: "GHC Wallet",
      ready: true,
      summary:
        ghc != null
          ? `${ghc.toLocaleString(undefined, { maximumFractionDigits: 2 })} GHC`
          : "Available · Send · Request · Receive",
      open: "wallet",
    },
    {
      id: "rewards",
      label: "Rewards & XP",
      ready: true,
      summary: rewardLabel,
      open: "rewards",
    },
    {
      id: "membership",
      label: "Membership",
      ready: membership.active,
      summary: membershipLabel,
      open: "membership",
    },
    {
      id: "marketplace",
      label: "Marketplace",
      ready: membership.active,
      summary:
        membership.tier === "free"
          ? "Standard listing tools"
          : "Enhanced visibility unlocked",
      open: "marketplace",
    },
    {
      id: "pi_payments",
      label: "Pi payments",
      ready: paymentsOk,
      summary: paymentsOk
        ? "User-to-App ready in Pi Browser"
        : "Open production URL in Pi Browser",
      open: "wallet",
    },
  ]

  const coreReady =
    layers.find((l) => l.id === "social")!.ready &&
    layers.find((l) => l.id === "greenhaven_id")!.ready

  return {
    userId,
    pi: {
      linked: piLinked,
      uid: piUid,
      username: piUsername,
      appSlug: PI_NETWORK_CONFIG.APP_SLUG || "gh-connect",
      sandbox: Boolean(PI_NETWORK_CONFIG.SANDBOX),
    },
    social: {
      displayName,
      onboarded,
      verified,
      photo,
      city,
      country,
    },
    greenHavenId: ghId,
    greenHavenIdDisplay: formatGreenHavenIdDisplay(ghId),
    membership,
    membershipLabel,
    layers,
    ecosystemReady: coreReady,
  }
}

/** Short product copy for empty states / onboarding */
export const ECOSYSTEM_TAGLINE =
  "One account: Pi identity, social profile, GreenHaven ID, GHC, rewards, and membership."
