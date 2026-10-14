"use client"

/**
 * Profile ecosystem hub — Identity → Membership → Wallet → Rewards
 * Display-only summaries. Balances from existing APIs; never invent GHC.
 */
import { useEffect, useState } from "react"
import {
  BadgeCheck,
  ChevronRight,
  Crown,
  Gift,
  Share2,
  Wallet,
} from "lucide-react"
import {
  formatGreenHavenIdDisplay,
  getOrCreateGreenHavenId,
} from "@/lib/domains/greenhaven-id"
import { IdentityService } from "@/lib/identity/identity-service"
import { getUserXp, xpProgress } from "@/lib/domains/reward-level-domain"

type MembershipSummary = {
  tier: "free" | "vip" | "vvip"
  active: boolean
  expiresAt?: number
}

type WalletSummary = {
  balance: number | null
  durable: boolean
}

function formatGhc(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatExpiry(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return ""
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return ""
  }
}

export function ProfileEcosystemHub({
  userId,
  displayName,
  onOpenWallet,
  onOpenMembership,
  onOpenRewards,
  onShareProfile,
}: {
  userId: string
  displayName?: string
  onOpenWallet?: () => void
  onOpenMembership?: () => void
  onOpenRewards?: () => void
  onShareProfile?: () => void
}) {
  const uid = userId || IdentityService.getCurrentUserId() || "member"
  const ghId = formatGreenHavenIdDisplay(getOrCreateGreenHavenId(uid, null))
  const [membership, setMembership] = useState<MembershipSummary>({
    tier: "free",
    active: true,
  })
  const [wallet, setWallet] = useState<WalletSummary>({ balance: null, durable: false })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/membership/status", {
          credentials: "include",
          cache: "no-store",
          headers: IdentityService.getAuthHeaders?.() || {},
        })
        if (!res.ok || cancelled) return
        const data = await res.json().catch(() => ({}))
        const e = data?.entitlement as Record<string, unknown> | undefined
        if (!e || cancelled) return
        const raw = String(e.tier || "free").toLowerCase()
        const tier: MembershipSummary["tier"] =
          raw === "vip" || raw === "vvip" ? raw : "free"
        setMembership({
          tier,
          active: e.active !== false,
          expiresAt:
            e.expiresAt != null && Number.isFinite(Number(e.expiresAt))
              ? Number(e.expiresAt)
              : undefined,
        })
      } catch {
        /* keep free default */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/economy/wallet/${encodeURIComponent(uid)}`, {
          credentials: "include",
          cache: "no-store",
          headers: IdentityService.getAuthHeaders?.() || {},
        })
        if (cancelled) return
        if (!res.ok) {
          setWallet({ balance: null, durable: false })
          return
        }
        const data = await res.json().catch(() => ({}))
        const bal =
          typeof data?.balance === "number"
            ? data.balance
            : typeof data?.wallet?.balance === "number"
              ? data.wallet.balance
              : typeof data?.available === "number"
                ? data.available
                : null
        if (!cancelled) {
          setWallet({
            balance: bal,
            durable: data?.ok === true || data?.durable === true,
          })
        }
      } catch {
        if (!cancelled) setWallet({ balance: null, durable: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const xp = (() => {
    try {
      const prog = xpProgress(getUserXp(uid))
      return {
        levelName: prog.level?.label || "Bronze",
        current: prog.current,
        next: prog.nextAt as number | null,
      }
    } catch {
      return { levelName: "Bronze", current: 0, next: null as number | null }
    }
  })()

  const tierLabel =
    membership.tier === "vvip" ? "VVIP" : membership.tier === "vip" ? "VIP" : "Free"
  const expiry = formatExpiry(membership.expiresAt)

  return (
    <div className="space-y-3" aria-label="GreenHaven ecosystem">
      {/* Identity */}
      <section className="rounded-[1.25rem] border border-border/60 bg-card p-4 shadow-[var(--gh-card-shadow)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Identity
        </p>
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <BadgeCheck size={16} className="shrink-0 text-sky-600" aria-hidden />
              GreenHaven ID
            </p>
            <p className="mt-1 font-mono text-[13px] font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
              {ghId}
            </p>
            {displayName ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayName}</p>
            ) : null}
          </div>
          {onShareProfile ? (
            <button
              type="button"
              onClick={onShareProfile}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card px-3 text-xs font-bold text-foreground shadow-sm transition hover:bg-muted"
            >
              <Share2 size={14} aria-hidden />
              Share
            </button>
          ) : null}
        </div>
      </section>

      {/* Membership · Wallet · Rewards — real data only */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenMembership}
          className="flex min-h-[100px] flex-col rounded-[1.25rem] border border-border/60 bg-card p-3.5 text-left shadow-[var(--gh-card-shadow)] transition hover:border-violet-200 hover:shadow-md active:scale-[0.99] dark:hover:border-violet-800"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:ring-violet-900/40">
              <Crown size={14} aria-hidden />
            </span>
            Membership
          </span>
          <span className="mt-2 text-lg font-bold text-foreground">{tierLabel}</span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">
            {membership.tier === "free"
              ? "Free plan"
              : membership.active
                ? expiry
                  ? `Active until ${expiry}`
                  : "Active"
                : "Inactive"}
          </span>
          <span className="mt-auto flex items-center gap-0.5 pt-2 text-[11px] font-bold text-violet-700 dark:text-violet-300">
            View membership
            <ChevronRight size={14} aria-hidden />
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenWallet}
          className="flex min-h-[100px] flex-col rounded-[1.25rem] border border-border/60 bg-card p-3.5 text-left shadow-[var(--gh-card-shadow)] transition hover:border-emerald-200 hover:shadow-md active:scale-[0.99] dark:hover:border-emerald-800"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
              <Wallet size={14} aria-hidden />
            </span>
            GHC Wallet
          </span>
          <span className="mt-2 text-lg font-bold tabular-nums text-foreground">
            {formatGhc(wallet.balance)}{" "}
            <span className="text-sm font-semibold text-muted-foreground">GHC</span>
          </span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">
            {wallet.durable ? "Ledger balance" : "Open wallet for full ledger"}
          </span>
          <span className="mt-auto flex items-center gap-0.5 pt-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            Open wallet
            <ChevronRight size={14} aria-hidden />
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenRewards}
          className="flex min-h-[100px] flex-col rounded-[1.25rem] border border-border/60 bg-card p-3.5 text-left shadow-[var(--gh-card-shadow)] transition hover:border-amber-200 hover:shadow-md active:scale-[0.99] dark:hover:border-amber-800"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/40">
              <Gift size={14} aria-hidden />
            </span>
            Rewards
          </span>
          <span className="mt-2 text-lg font-bold text-foreground">
            {xp.levelName || "Bronze"}
          </span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">
            {Math.round(Number(xp.current) || 0)} XP
            {xp.next != null ? ` · ${Math.round(Number(xp.next))} to next` : ""}
          </span>
          <span className="mt-auto flex items-center gap-0.5 pt-2 text-[11px] font-bold text-amber-800 dark:text-amber-300">
            View rewards
            <ChevronRight size={14} aria-hidden />
          </span>
        </button>
      </div>
    </div>
  )
}
