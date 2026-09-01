"use client"

/**
 * Secondary destinations formerly on the bottom bar — live under Profile.
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

const ITEMS: {
  id: string
  label: string
  icon: React.ReactNode
  action: "tab" | "event"
  target: string
}[] = [
  { id: "ecosystem", label: "Ecosystem", icon: <Sparkles size={16} />, action: "event", target: "ghc:open-ecosystem" },
  { id: "matches", label: "Matches", icon: <Heart size={16} />, action: "tab", target: "matches" },
  { id: "communities", label: "Communities", icon: <Users size={16} />, action: "tab", target: "communities" },
  { id: "wallet", label: "Wallet", icon: <Wallet size={16} />, action: "event", target: "ghc:open-wallet" },
  { id: "rewards", label: "Rewards", icon: <Gift size={16} />, action: "event", target: "ghc:open-rewards" },
  { id: "membership", label: "Membership", icon: <Crown size={16} />, action: "event", target: "ghc:open-membership" },
  { id: "marketplace", label: "Marketplace", icon: <ShoppingBag size={16} />, action: "tab", target: "discover" },
  { id: "settings", label: "Settings", icon: <Settings size={16} />, action: "event", target: "ghc:open-settings" },
]

export function ProfileMoreNav({
  onOpenSettings,
  onOpenWallet,
}: {
  onOpenSettings?: () => void
  onOpenWallet?: () => void
}) {
  const go = (item: (typeof ITEMS)[0]) => {
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
      } catch { /* */ }
      return
    }
    try {
      window.dispatchEvent(new CustomEvent(item.target, { detail: {} }))
    } catch { /* */ }
  }

  return (
    <section className="gh-surface-muted p-3" aria-label="More">
      <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        More
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item)}
            className="flex flex-col items-center gap-1.5 rounded-[var(--gh-radius-sm)] bg-background/80 px-1 py-2.5 text-center transition hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30"
          >
            <span className="text-emerald-700 dark:text-emerald-300">{item.icon}</span>
            <span className="text-[10px] font-bold leading-tight text-foreground">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
