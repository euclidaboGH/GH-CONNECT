"use client"

/**
 * Secondary destinations under Profile — grouped by product layer.
 *
 * Layers (Step 2 product clarity):
 * - Social: matches, communities
 * - Value: wallet + rewards + membership (one money area)
 * - Tools: marketplace, ecosystem, settings
 *
 * Inspired by fintech “one money tab” and social apps that keep ≤5 primary
 * nav items with secondary destinations under Profile.
 */

import {
  Sparkles,
  Heart,
  Users,
  Wallet,
  Gift,
  Crown,
  ShoppingBag,
  Settings,
} from "lucide-react"

type NavItem = {
  id: string
  label: string
  icon: React.ReactNode
  action: "tab" | "event"
  target: string
  /** subtitle under Value group items */
  hint?: string
}

const SOCIAL: NavItem[] = [
  { id: "matches", label: "Matches", icon: <Heart size={16} />, action: "tab", target: "matches" },
  {
    id: "communities",
    label: "Communities",
    icon: <Users size={16} />,
    action: "tab",
    target: "communities",
  },
]

/** Unified value area — GHC wallet, rewards, membership (not π ledger) */
const VALUE: NavItem[] = [
  {
    id: "wallet",
    label: "Wallet",
    icon: <Wallet size={16} />,
    action: "event",
    target: "ghc:open-wallet",
    hint: "GHC balance",
  },
  {
    id: "rewards",
    label: "Rewards",
    icon: <Gift size={16} />,
    action: "event",
    target: "ghc:open-rewards",
    hint: "Earn GHC",
  },
  {
    id: "membership",
    label: "Membership",
    icon: <Crown size={16} />,
    action: "event",
    target: "ghc:open-membership",
    hint: "VIP · boosts",
  },
]

const TOOLS: NavItem[] = [
  {
    id: "marketplace",
    label: "Marketplace",
    icon: <ShoppingBag size={16} />,
    action: "tab",
    target: "discover",
  },
  {
    id: "ecosystem",
    label: "Ecosystem",
    icon: <Sparkles size={16} />,
    action: "event",
    target: "ghc:open-ecosystem",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings size={16} />,
    action: "event",
    target: "ghc:open-settings",
  },
]

function NavGrid({
  items,
  onOpenSettings,
  onOpenWallet,
}: {
  items: NavItem[]
  onOpenSettings?: () => void
  onOpenWallet?: () => void
}) {
  const go = (item: NavItem) => {
    if (item.id === "settings" && onOpenSettings) {
      onOpenSettings()
      return
    }
    if (item.id === "wallet" && onOpenWallet) {
      onOpenWallet()
      return
    }
    if (item.action === "tab") {
      try {
        window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: item.target }))
      } catch {
        /* */
      }
      return
    }
    try {
      window.dispatchEvent(new CustomEvent(item.target, { detail: {} }))
    } catch {
      /* */
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => go(item)}
          className="flex flex-col items-center gap-1 rounded-[var(--gh-radius-sm)] bg-background/80 px-1 py-2.5 text-center transition hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30"
        >
          <span className="text-emerald-700 dark:text-emerald-300">{item.icon}</span>
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
  return (
    <section className="space-y-3 p-3" aria-label="More">
      <div className="gh-surface-muted rounded-xl p-3">
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Social
        </p>
        <NavGrid items={SOCIAL} onOpenSettings={onOpenSettings} onOpenWallet={onOpenWallet} />
      </div>

      <div className="gh-surface-muted rounded-xl border border-emerald-200/50 p-3 dark:border-emerald-900/40">
        <div className="mb-2 flex items-baseline justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Value
          </p>
          <p className="text-[9px] font-medium text-muted-foreground">GHC · not Pi balance</p>
        </div>
        <NavGrid items={VALUE} onOpenSettings={onOpenSettings} onOpenWallet={onOpenWallet} />
      </div>

      <div className="gh-surface-muted rounded-xl p-3">
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Tools
        </p>
        <NavGrid items={TOOLS} onOpenSettings={onOpenSettings} onOpenWallet={onOpenWallet} />
      </div>
    </section>
  )
}
