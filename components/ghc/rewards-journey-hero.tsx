"use client"

/**
 * Rewards as a journey/game surface — not an accounting ledger.
 * XP path + streak + today's opportunities.
 */

import { useMemo, useState, useCallback } from "react"
import { Award, Flame, Sparkles, Check, Lock } from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import {
  getUserXp,
  xpProgress,
  getDailyStreak,
  claimDailyStreak,
  DAILY_STREAK_GHC,
} from "@/lib/domains/reward-level-domain"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { useGHC } from "@/contexts/ghc-context"

function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0.00"
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function RewardsJourneyHero({
  userId,
  onClaimed,
  onOpenWallet,
}: {
  userId: string
  onClaimed?: () => void
  onOpenWallet?: () => void
}) {
  const ghc = useGHC()
  const [tick, setTick] = useState<number>(0)

  const membershipTier = useMemo(() => {
    // Re-read membership status when tick advances after claim/refresh
    void tick
    try {
      const st = getBoundDomainServices()?.membership?.getStatus?.() as { tier?: string } | null
      return String(st?.tier || "free").toLowerCase()
    } catch {
      return "free"
    }
  }, [tick])

  const xp = useMemo(() => {
    void tick
    return getUserXp(userId)
  }, [userId, tick])
  const prog = useMemo(() => xpProgress(xp), [xp])
  const daily = useMemo(() => {
    void tick
    return getDailyStreak(userId, membershipTier)
  }, [userId, membershipTier, tick])

  const walletBal = useMemo(() => {
    void tick
    try {
      return Number(getBoundDomainServices()?.economy?.getWallet?.()?.balance) || 0
    } catch {
      return 0
    }
  }, [tick])

  const claimDaily = useCallback(async () => {
    // Server-authoritative daily claim only — no local GHC mint
    try {
      const res = await fetch("/api/economy/rewards/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        ghc.addToast?.(data.error || data.message || "Claim failed", "error")
        setTick((t) => t + 1)
        return
      }
      const amt = data.userAmount ?? data.amount ?? data.ghc ?? 0
      const day = data.cycleDay ?? data.day ?? ""
      // Server ledger → client wallet (no optimistic credit)
      try {
        const { syncWalletAfterServerClaim } = await import(
          "@/lib/domains/adapters/wallet-sync-after-claim"
        )
        await syncWalletAfterServerClaim({
          userId,
          claimedAmount: Number(amt) || null,
          alreadyClaimed: Boolean(data.alreadyClaimed || data.idempotent),
          referenceId: data.referenceId != null ? String(data.referenceId) : null,
        })
      } catch {
        /* keep last known balance */
      }
      ghc.addToast?.(
        data.alreadyClaimed || data.idempotent
          ? `Already claimed${amt ? ` · ${amt} GHC` : ""}`
          : `+${amt} GHC${day ? ` · Day ${day}/7` : ""}`,
        "success"
      )
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:daily-reward-claimed", { detail: { ...data, server: true } })
        )
      } catch {
        /* */
      }
      setTick((t) => t + 1)
      onClaimed?.()
    } catch {
      ghc.addToast?.("Claim failed", "error")
      setTick((t) => t + 1)
    }
  }, [userId, ghc, onClaimed])

  const opportunities = [
    {
      id: "daily",
      label: "Daily login reward",
      ghc: daily.todayGhc || DAILY_STREAK_GHC[daily.displayCycleDay] || 10,
      done: !daily.canClaimToday,
      action: daily.canClaimToday ? () => void claimDaily() : undefined,
      cta: daily.canClaimToday ? "Claim" : "Done",
    },
    {
      id: "profile",
      label: "Complete your profile",
      ghc: 5,
      done: Boolean(ghc.profile?.bio) && Boolean((ghc.profile as { photos?: string[] })?.photos?.[0]),
      action: () => {
        try {
          window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "profile" }))
        } catch {
          /* */
        }
      },
      cta: "Open",
    },
    {
      id: "post",
      label: "Share a thoughtful post",
      ghc: 2,
      done: false,
      action: () => {
        try {
          window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { mode: "post" } }))
        } catch {
          /* */
        }
      },
      cta: "Create",
    },
    {
      id: "interact",
      label: "Meaningful interaction",
      ghc: 1,
      done: false,
      action: () => {
        try {
          window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
        } catch {
          /* */
        }
      },
      cta: "Explore",
    },
  ]

  const nextLabel = prog.nextAt != null ? prog.level.label : prog.level.label
  const xpToNext =
    prog.nextAt != null ? Math.max(0, prog.nextAt - xp) : 0

  return (
    <div className="mx-3 mt-3 space-y-4">
      {/* Journey hero — real XP / balance / level only */}
      <section
        className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-[var(--gh-card-shadow-lg)]"
        aria-label="Your GHC journey"
      >
        <div className="border-b border-border/50 bg-gradient-to-br from-emerald-50/90 via-card to-card px-4 pb-4 pt-4 dark:from-emerald-950/30 dark:via-card dark:to-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300">
                Your GHC Journey
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Quality contributions · not pay-to-win
              </p>
            </div>
            {onOpenWallet && (
              <button
                type="button"
                onClick={onOpenWallet}
                className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-card dark:text-emerald-200"
              >
                Wallet
              </button>
            )}
          </div>

          {/* Level · Balance · XP — real values only */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border/50 bg-card/80 px-2.5 py-3 text-center shadow-sm">
              <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/40">
                <Award size={16} className="text-amber-600" aria-hidden />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Level</p>
              <p className="mt-0.5 truncate text-[13px] font-bold text-foreground">{prog.level.label}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/80 px-2.5 py-3 text-center shadow-sm">
              <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center">
                <GhcCoinIcon size={28} title="GreenHaven Coin" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Balance</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums text-foreground">
                {formatGhc(walletBal)} <span className="text-[10px] font-semibold text-muted-foreground">GHC</span>
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/80 px-2.5 py-3 text-center shadow-sm">
              <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
                <Sparkles size={16} className="text-emerald-700" aria-hidden />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">XP</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums text-foreground">
                {xp.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
              <span className="text-muted-foreground">
                {prog.nextAt != null ? (
                  <>
                    <span className="font-bold text-foreground">{xpToNext}</span> XP to next
                  </>
                ) : (
                  "Max level"
                )}
              </span>
              <span className="text-muted-foreground">{Math.min(100, Math.round(prog.pct))}%</span>
            </div>
            <div
              className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.min(100, Math.round(prog.pct))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="XP progress toward next milestone"
            >
              <div
                className="h-full rounded-full bg-[var(--gh-green)] transition-all"
                style={{ width: `${Math.min(100, prog.pct)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
              Next milestone: <span className="font-bold text-foreground">{nextLabel}</span>
              {prog.nextAt != null ? ` · ${xpToNext} XP to unlock` : ""}
              {" · "}Membership is separate and does not buy XP
            </p>
          </div>
        </div>

        {/* 7-day streak — real daily state only */}
        <div className="px-4 py-4">
          <p className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-foreground">
            <Flame size={16} className="text-orange-500" aria-hidden />
            {daily.streakDays > 0 ? `${daily.streakDays}-day GHC streak` : "Start your GHC streak"}
            <span className="font-semibold text-muted-foreground">
              · Day {daily.displayCycleDay}/7
            </span>
          </p>
          <div className="flex justify-between gap-1" role="list" aria-label="Seven-day streak progress">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const claimedThrough = daily.canClaimToday
                ? daily.displayCycleDay - 1
                : daily.displayCycleDay
              const done = d <= claimedThrough
              const isToday = d === daily.displayCycleDay && daily.canClaimToday
              const ghcLabel = DAILY_STREAK_GHC[d]
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1.5" role="listitem">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold transition ${
                      done
                        ? "bg-[var(--gh-green)] text-white shadow-sm shadow-emerald-700/20"
                        : isToday
                          ? "bg-emerald-50 text-emerald-900 ring-2 ring-[var(--gh-green)] dark:bg-emerald-950/50 dark:text-emerald-100"
                          : "bg-muted/80 text-muted-foreground"
                    }`}
                    aria-label={
                      done
                        ? `Day ${d} claimed`
                        : isToday
                          ? `Day ${d} available to claim`
                          : `Day ${d}`
                    }
                  >
                    {done ? <Check size={14} strokeWidth={3} aria-hidden /> : d}
                  </div>
                  <span className="text-[9px] font-semibold tabular-nums text-muted-foreground">
                    {ghcLabel != null ? formatGhc(ghcLabel) : ""}
                  </span>
                </div>
              )
            })}
          </div>
          {daily.canClaimToday ? (
            <button
              type="button"
              onClick={() => void claimDaily()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--gh-green)] py-3.5 text-[13px] font-bold text-white shadow-md shadow-emerald-700/25 transition hover:brightness-105 active:scale-[0.99]"
            >
              <GhcCoinIcon size={18} />
              Claim day {daily.displayCycleDay} · +{formatGhc(daily.todayGhc)} GHC
            </button>
          ) : (
            <p className="mt-3 text-center text-[11px] font-medium text-muted-foreground">
              Today claimed · next reward after midnight (Africa/Lagos)
            </p>
          )}
        </div>
      </section>

      {/* Today's opportunities — labels/CTAs only; amounts from existing config */}
      <section aria-label="Today's opportunities">
        <p className="mb-2.5 flex items-center gap-1.5 px-0.5 text-[12px] font-bold text-foreground">
          <Sparkles size={14} className="text-emerald-700" aria-hidden />
          Today&apos;s opportunities
        </p>
        <ul className="space-y-2">
          {opportunities.map((op) => (
            <li
              key={op.id}
              className="flex items-center gap-3 rounded-[1.25rem] border border-border/50 bg-card px-3.5 py-3 shadow-[var(--gh-card-shadow)]"
            >
              <span className="gh-icon-tile flex h-10 w-10 shrink-0 items-center justify-center">
                <GhcCoinIcon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground">{op.label}</span>
                <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                  +{formatGhc(op.ghc)} GHC
                </span>
              </span>
              {op.done ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
                  <Check size={12} aria-hidden /> Done
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => op.action?.()}
                  className="rounded-full bg-[var(--gh-green)] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:brightness-105 active:scale-95"
                >
                  {op.cta}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 px-0.5 text-[10px] leading-relaxed text-muted-foreground">
          Rewards favour quality and trust — not spam. Likes, empty comments, and mass follows
          do not farm GHC. Daily caps and validation protect the economy.
        </p>
      </section>
    </div>
  )
}
