"use client"

/**
 * Profile ecosystem hub — Identity · Membership · Wallet · Rewards · Market · Ecosystem
 * Display-only summaries from existing APIs. Never invent GHC balances or entitlements.
 */

import { useCallback, useEffect, useState } from "react"
import {
  BadgeCheck,
  ChevronRight,
  Crown,
  Gift,
  Share2,
  Wallet,
  ShoppingBag,
  LayoutGrid,
  RefreshCw,
} from "lucide-react"
import {
  formatGreenHavenIdDisplay,
  getOrCreateGreenHavenId,
} from "@/lib/domains/greenhaven-id"
import { IdentityService } from "@/lib/identity/identity-service"
import { getUserXp, xpProgress } from "@/lib/domains/reward-level-domain"
import { navigateTo } from "@/lib/navigation/navigate"

type MembershipSummary = {
  tier: "free" | "vip" | "vvip"
  active: boolean
  expiresAt?: number
  loaded: boolean
}

type WalletSummary = {
  balance: number | null
  durable: boolean
  loaded: boolean
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
    loaded: false,
  })
  const [wallet, setWallet] = useState<WalletSummary>({
    balance: null,
    durable: false,
    loaded: false,
  })
  const [isOffline, setIsOffline] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadMembership = useCallback(async () => {
    try {
      const res = await fetch("/api/membership/status", {
        credentials: "include",
        cache: "no-store",
        headers: IdentityService.getAuthHeaders?.() || {},
      })
      if (!res.ok) {
        setMembership((m) => ({ ...m, loaded: true }))
        return
      }
      const data = await res.json().catch(() => ({}))
      const e = data?.entitlement as Record<string, unknown> | undefined
      if (!e) {
        setMembership((m) => ({ ...m, loaded: true }))
        return
      }
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
        loaded: true,
      })
    } catch {
      setMembership((m) => ({ ...m, loaded: true }))
    }
  }, [])

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch(`/api/economy/wallet/${encodeURIComponent(uid)}`, {
        credentials: "include",
        cache: "no-store",
        headers: IdentityService.getAuthHeaders?.() || {},
      })
      if (!res.ok) {
        setWallet({ balance: null, durable: false, loaded: true })
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
      setWallet({
        balance: bal,
        durable: data?.ok === true || data?.durable === true,
        loaded: true,
      })
    } catch {
      setWallet({ balance: null, durable: false, loaded: true })
    }
  }, [uid])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadMembership(), loadWallet()])
    } finally {
      setRefreshing(false)
    }
  }, [loadMembership, loadWallet])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (typeof window === "undefined") return
    const sync = () => setIsOffline(!navigator.onLine)
    sync()
    const onOnline = () => {
      sync()
      void refreshAll()
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", sync)
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshAll()
    }
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("ghc:membership-refresh", refreshAll)
    window.addEventListener("ghc:pi-payment-complete", refreshAll)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", sync)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("ghc:membership-refresh", refreshAll)
      window.removeEventListener("ghc:pi-payment-complete", refreshAll)
    }
  }, [refreshAll])

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

  const openWallet = () => {
    if (onOpenWallet) onOpenWallet()
    else navigateTo("wallet")
  }
  const openMembership = () => {
    if (onOpenMembership) onOpenMembership()
    else navigateTo("membership")
  }
  const openRewards = () => {
    if (onOpenRewards) onOpenRewards()
    else navigateTo("rewards")
  }

  return (
    <div className="space-y-3" aria-label="GreenHaven ecosystem on profile">
      {isOffline ? (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          You are offline — showing the last known membership and wallet values.
        </p>
      ) : null}

      {/* Identity */}
      <section className="rounded-[1.25rem] border border-border/60 bg-card p-4 shadow-[var(--gh-card-shadow)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Identity
          </p>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={refreshing}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Refresh ecosystem summaries"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden />
          </button>
        </div>
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <BadgeCheck size={16} className="shrink-0 text-sky-600" aria-hidden />
              GreenHaven ID
            </p>
            <p className="mt-1 break-all font-mono text-[13px] font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
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

      <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Your services
      </p>

      {/* Membership · Wallet · Rewards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <button
          type="button"
          onClick={openMembership}
          className="flex min-h-[108px] flex-col rounded-[1.25rem] border border-border/60 bg-card p-3.5 text-left shadow-[var(--gh-card-shadow)] transition hover:border-violet-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 active:scale-[0.99] dark:hover:border-violet-800"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:ring-violet-900/40">
              <Crown size={14} aria-hidden />
            </span>
            Membership
          </span>
          <span className="mt-2 text-lg font-bold text-foreground">
            {membership.loaded ? tierLabel : "…"}
          </span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">
            {!membership.loaded
              ? "Loading…"
              : membership.tier === "free"
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
          onClick={openWallet}
          className="flex min-h-[108px] flex-col rounded-[1.25rem] border border-border/60 bg-card p-3.5 text-left shadow-[var(--gh-card-shadow)] transition hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99] dark:hover:border-emerald-800"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
              <Wallet size={14} aria-hidden />
            </span>
            GHC Wallet
          </span>
          <span className="mt-2 text-lg font-bold tabular-nums text-foreground">
            {wallet.loaded ? formatGhc(wallet.balance) : "…"}{" "}
            <span className="text-sm font-semibold text-muted-foreground">GHC</span>
          </span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">
            {!wallet.loaded
              ? "Loading…"
              : wallet.durable
                ? "Ledger balance"
                : "Open wallet for full ledger"}
          </span>
          <span className="mt-auto flex items-center gap-0.5 pt-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            Open wallet
            <ChevronRight size={14} aria-hidden />
          </span>
        </button>

        <button
          type="button"
          onClick={openRewards}
          className="flex min-h-[108px] flex-col rounded-[1.25rem] border border-border/60 bg-card p-3.5 text-left shadow-[var(--gh-card-shadow)] transition hover:border-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.99] dark:hover:border-amber-800"
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

      <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Marketplace &amp; ecosystem
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => navigateTo("marketplace")}
          className="flex min-h-[80px] flex-col rounded-[1.25rem] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-card p-3.5 text-left shadow-sm transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99] dark:border-emerald-900 dark:from-emerald-950/30"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            <ShoppingBag size={14} aria-hidden />
            Marketplace
          </span>
          <span className="mt-1 text-[12px] text-muted-foreground">Buy · sell · listings</span>
          <span className="mt-auto flex items-center gap-0.5 pt-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            Open
            <ChevronRight size={14} aria-hidden />
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigateTo("ecosystem")}
          className="flex min-h-[80px] flex-col rounded-[1.25rem] border border-border/60 bg-card p-3.5 text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99]"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
            <LayoutGrid size={14} aria-hidden />
            Full ecosystem
          </span>
          <span className="mt-1 text-[12px] text-muted-foreground">All GreenHaven services</span>
          <span className="mt-auto flex items-center gap-0.5 pt-2 text-[11px] font-bold text-foreground">
            Explore
            <ChevronRight size={14} aria-hidden />
          </span>
        </button>
      </div>
    </div>
  )
}
