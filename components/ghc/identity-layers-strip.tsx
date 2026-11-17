"use client"

/**
 * Three distinct ecosystem layers — never mixed in one control.
 * Social ID | Membership | Wallet
 */

import { Contact, Crown, Wallet } from "lucide-react"
import { getOrCreateGreenHavenId, formatGreenHavenIdDisplay } from "@/lib/domains/greenhaven-id"
import { getMembershipStatus } from "@/lib/domains/membership-domain"

export function IdentityLayersStrip({
  userId,
  preferredId,
  onOpenWallet,
  onOpenMembership,
  onFocusIdentity,
}: {
  userId: string
  preferredId?: string | null
  onOpenWallet?: () => void
  onOpenMembership?: () => void
  onFocusIdentity?: () => void
}) {
  const gh = formatGreenHavenIdDisplay(getOrCreateGreenHavenId(userId, preferredId))
  let tierLabel = "Free"
  try {
    const st = getMembershipStatus(userId)
    tierLabel =
      st.tier === "vvip" ? "VVIP" : st.tier === "vip" ? "VIP" : "Free"
  } catch {
    /* */
  }

  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="group"
      aria-label="Identity, membership, and wallet"
    >
      <Layer
        icon={<Contact size={15} />}
        title="GH ID"
        subtitle={gh}
        hint="Who you are"
        tone="social"
        onClick={onFocusIdentity}
      />
      <Layer
        icon={<Crown size={15} />}
        title="Membership"
        subtitle={tierLabel}
        hint="Your level"
        tone="membership"
        onClick={onOpenMembership}
      />
      <Layer
        icon={<Wallet size={15} />}
        title="Wallet"
        subtitle="GHC"
        hint="What you own"
        tone="wallet"
        onClick={onOpenWallet}
      />
    </div>
  )
}

function Layer({
  icon,
  title,
  subtitle,
  hint,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  hint: string
  tone: "social" | "membership" | "wallet"
  onClick?: () => void
}) {
  const toneCls =
    tone === "social"
      ? "bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/30"
      : tone === "membership"
        ? "bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/30"
        : "bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[72px] flex-col items-start gap-0.5 rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] ${toneCls}`}
    >
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </span>
      <span className="w-full truncate text-[12px] font-bold text-foreground">{subtitle}</span>
      <span className="text-[9px] font-medium text-muted-foreground">{hint}</span>
    </button>
  )
}
