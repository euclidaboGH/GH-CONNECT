"use client"

import { useMemo, type ReactNode } from "react"
import {
  BadgeCheck,
  ChevronRight,
  Coins,
  Crown,
  Fingerprint,
  Gift,
  Contact,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react"
import {
  resolveGreenHavenAccount,
  ECOSYSTEM_TAGLINE,
  type AccountLayerId,
  type GreenHavenAccount,
} from "@/lib/domains/gh-account"
import { isPiPaymentsAvailable } from "@/lib/pi-u2a-payment"

const LAYER_ICON: Partial<Record<AccountLayerId, ReactNode>> = {
  pi: <Fingerprint size={14} aria-hidden />,
  session: <UserRound size={14} aria-hidden />,
  social: <UserRound size={14} aria-hidden />,
  greenhaven_id: <Contact size={14} aria-hidden />,
  wallet: <Wallet size={14} aria-hidden />,
  rewards: <Gift size={14} aria-hidden />,
  membership: <Crown size={14} aria-hidden />,
  marketplace: <ShoppingBag size={14} aria-hidden />,
  pi_payments: <Coins size={14} aria-hidden />,
}

export function EcosystemHubCard({
  account,
  userId,
  piUid,
  piUsername,
  displayName,
  onboarded,
  verified,
  photo,
  city,
  country,
  ghcAvailable,
  rewardLevelLabel,
  onOpen,
  compact = false,
}: {
  /** Pass a pre-resolved account, or supply fields below */
  account?: GreenHavenAccount
  userId?: string
  piUid?: string | null
  piUsername?: string | null
  displayName?: string
  onboarded?: boolean
  verified?: boolean
  photo?: string | null
  city?: string
  country?: string
  ghcAvailable?: number
  rewardLevelLabel?: string
  onOpen?: (target: NonNullable<GreenHavenAccount["layers"][0]["open"]>) => void
  compact?: boolean
}) {
  const resolved = useMemo(
    () =>
      account ||
      resolveGreenHavenAccount({
        userId,
        piUid,
        piUsername,
        displayName,
        onboarded,
        verified,
        photo,
        city,
        country,
        ghcAvailable,
        rewardLevelLabel,
        piPaymentsAvailable: isPiPaymentsAvailable(),
      }),
    [
      account,
      userId,
      piUid,
      piUsername,
      displayName,
      onboarded,
      verified,
      photo,
      city,
      country,
      ghcAvailable,
      rewardLevelLabel,
    ]
  )

  const primary = resolved.layers.filter((l) =>
    ["pi", "social", "greenhaven_id", "wallet", "membership", "pi_payments"].includes(l.id)
  )

  return (
    <section
      className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-card to-teal-50/40 p-3.5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/50 dark:to-teal-950/20"
      aria-label="GreenHaven account ecosystem"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            GreenHaven account
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold text-foreground">
            {resolved.social.displayName}
            {resolved.social.verified ? (
              <BadgeCheck
                size={16}
                className="ml-1 inline text-sky-500"
                aria-label="Verified"
              />
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-emerald-800/90 dark:text-emerald-200/90">
            {resolved.greenHavenIdDisplay}
            <span className="mx-1.5 text-muted-foreground">·</span>
            {resolved.membershipLabel}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            resolved.ecosystemReady
              ? "bg-emerald-600 text-white"
              : "bg-amber-500 text-white"
          }`}
        >
          {resolved.ecosystemReady ? "Linked" : "Setup"}
        <button
          type="button"
          className="ml-2 text-[10px] font-bold text-emerald-700 underline-offset-2 hover:underline"
          onClick={(e) => {
            e.stopPropagation()
            try {
              window.dispatchEvent(new CustomEvent("ghc:open-ecosystem", { detail: {} }))
            } catch { /* */ }
          }}
        >
          Map
        </button>
        </span>
      </div>

      {!compact ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {ECOSYSTEM_TAGLINE}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1">
        {primary.map((layer) => (
          <li key={layer.id}>
            <button
              type="button"
              onClick={() => layer.open && onOpen?.(layer.open)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-white/70 dark:hover:bg-white/5"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  layer.ready
                    ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {LAYER_ICON[layer.id] || <UserRound size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-foreground">
                  {layer.label}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {layer.summary}
                </span>
              </span>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  layer.ready ? "bg-emerald-500" : "bg-amber-400"
                }`}
                aria-hidden
              />
              <ChevronRight size={14} className="shrink-0 text-muted-foreground/50" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
