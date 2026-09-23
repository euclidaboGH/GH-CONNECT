"use client"

/**
 * Profile account / personal services — NOT a GreenHaven service directory.
 *
 * Groups:
 * - Social (profile-relevant): Matches only (Communities live under profile content)
 * - Personal services: Wallet, Rewards, Membership
 * - Support: Settings, Help
 *
 * Marketplace and Ecosystem are reached from Home → Ecosystem, not Profile.
 */

import { Heart, Wallet, Gift, Crown, Settings, HelpCircle } from "lucide-react"
import { navigateTo, openMembership } from "@/lib/navigation/navigate"

type NavItem = {
  id: string
  label: string
  icon: React.ReactNode
  hint?: string
  onClick: () => void
}

function NavGrid({ items }: { items: NavItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[var(--gh-radius-sm)] bg-background/80 px-1 py-2.5 text-center transition hover:bg-emerald-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-emerald-950/30"
        >
          <span className="text-emerald-700 dark:text-emerald-300" aria-hidden>
            {item.icon}
          </span>
          <span className="text-[10px] font-bold leading-tight text-foreground">{item.label}</span>
          {item.hint ? (
            <span className="text-[9px] leading-tight text-muted-foreground">{item.hint}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function ProfileMoreNav({
  onOpenSettings,
  onOpenWallet,
}: {
  onOpenSettings?: () => void
  onOpenWallet?: () => void
}) {
  const social: NavItem[] = [
    {
      id: "matches",
      label: "Matches",
      icon: <Heart size={16} />,
      onClick: () => {
        navigateTo("matches")
      },
    },
  ]

  const personal: NavItem[] = [
    {
      id: "wallet",
      label: "Wallet",
      icon: <Wallet size={16} />,
      hint: "GHC balance",
      onClick: () => {
        if (onOpenWallet) onOpenWallet()
        else navigateTo("wallet")
      },
    },
    {
      id: "rewards",
      label: "Rewards",
      icon: <Gift size={16} />,
      hint: "Earn GHC",
      onClick: () => navigateTo("rewards"),
    },
    {
      id: "membership",
      label: "Membership",
      icon: <Crown size={16} />,
      hint: "VIP · boosts",
      onClick: () => openMembership(),
    },
  ]

  const support: NavItem[] = [
    {
      id: "settings",
      label: "Settings",
      icon: <Settings size={16} />,
      onClick: () => {
        if (onOpenSettings) onOpenSettings()
        else navigateTo("settings")
      },
    },
    {
      id: "help",
      label: "Help",
      icon: <HelpCircle size={16} />,
      onClick: () => navigateTo("help"),
    },
  ]

  return (
    <section className="space-y-3 p-3" aria-label="Account and more">
      <div className="gh-surface-muted rounded-xl p-3">
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Social
        </p>
        <NavGrid items={social} />
      </div>

      <div className="gh-surface-muted rounded-xl border border-emerald-200/50 p-3 dark:border-emerald-900/40">
        <div className="mb-2 flex items-baseline justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Personal services
          </p>
          <p className="text-[9px] font-medium text-muted-foreground">GHC · not Pi balance</p>
        </div>
        <NavGrid items={personal} />
      </div>

      <div className="gh-surface-muted rounded-xl p-3">
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Support
        </p>
        <NavGrid items={support} />
      </div>
    </section>
  )
}
