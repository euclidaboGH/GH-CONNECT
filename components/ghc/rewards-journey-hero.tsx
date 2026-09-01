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
  const ghc = useGHC() as {
    profile?: Record<string, unknown>
    addToast?: (m: string, t?: string) => void
  }
  const [tick, setTick] = useState(0)

  const membershipTier = useMemo(() => {
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
    const res = claimDailyStreak(userId, membershipTier)
    if (!res.ok) {
      ghc.addToast?.(res.error || "Already claimed", "error")
      setTick((t) => t + 1)
      return
    }
    try {
      const eco = getBoundDomainServices()?.economy as
        | { claimReward?: (id: string) => Promise<{ ok: boolean }> }
        | undefined
      // Best-effort ledger claim of staged pending
      if (eco?.claimReward && res.referenceId) {
        /* staged elsewhere */
      }
    } catch {
      /* */
    }
    ghc.addToast?.(
      `Day ${res.cycleDay}: +${res.ghc} GHC · +${res.xp} XP`,
      "success"
    )
    try {
      window.dispatchEvent(new CustomEvent("ghc:daily-reward-claimed", { detail: res }))
    } catch {
      /* */
    }
    setTick((t) => t + 1)
    onClaimed?.()
  }, [userId, membershipTier, ghc, onClaimed])

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
    <div className="mx-4 mt-3 space-y-3">
      {/* Journey card */}
      <section
        className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-card to-amber-50/40 shadow-sm dark:border-emerald-900 dark:from-emerald-950/40 dark:to-card"
        aria-label="Your GHC journey"
      >
        <div className="px-4 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">
            Your GHC Journey
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="flex items-baseline gap-1.5 text-[28px] font-black tabular-nums text-foreground">
              <GhcCoinIcon size={28} />
              {formatGhc(walletBal)}
              <span className="text-sm font-bold text-muted-foreground">GHC</span>
            </p>
            <button
              type="button"
              onClick={onOpenWallet}
              className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white"
            >
              Wallet
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-foreground">
                <Award size={14} className="text-amber-600" />
                {prog.level.label}
              </span>
              <span className="text-muted-foreground">
                {xp.toLocaleString()} XP
                {prog.nextAt != null ? ` · ${xpToNext} XP to next` : " · Max level"}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-amber-500 transition-all"
                style={{ width: `${Math.min(100, prog.pct)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Next milestone: <span className="font-bold text-foreground">{nextLabel}</span>
              {prog.nextAt != null ? ` · ${xpToNext} XP to unlock` : ""}
              {" · "}Membership is separate and does not buy XP
            </p>
          </div>
        </div>

        {/* 7-day streak */}
        <div className="mt-4 border-t border-emerald-100/80 px-4 py-3 dark:border-emerald-900/50">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-foreground">
            <Flame size={15} className="text-orange-500" />
            {daily.streakDays > 0 ? `${daily.streakDays}-day streak` : "Start your streak"}
            <span className="font-semibold text-muted-foreground">
              · Day {daily.displayCycleDay}/7
            </span>
          </p>
          <div className="flex justify-between gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const claimedThrough = daily.canClaimToday
                ? daily.displayCycleDay - 1
                : daily.displayCycleDay
              const done = d <= claimedThrough
              const isToday = d === daily.displayCycleDay && daily.canClaimToday
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                      done
                        ? "bg-emerald-600 text-white"
                        : isToday
                          ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : d === 7 ? "🎁" : d}
                  </div>
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    {DAILY_STREAK_GHC[d] ?? ""}
                  </span>
                </div>
              )
            })}
          </div>
          {daily.canClaimToday ? (
            <button
              type="button"
              onClick={() => void claimDaily()}
              className="mt-3 w-full rounded-full bg-emerald-700 py-2.5 text-[13px] font-bold text-white shadow-sm"
            >
              Claim day {daily.displayCycleDay} · +{daily.todayGhc} GHC
            </button>
          ) : (
            <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">
              Today claimed · next reward after midnight (Africa/Lagos)
            </p>
          )}
        </div>
      </section>

      {/* Today's opportunities */}
      <section aria-label="Today's opportunities">
        <p className="mb-2 flex items-center gap-1.5 px-0.5 text-[12px] font-bold text-foreground">
          <Sparkles size={14} className="text-violet-600" />
          Today&apos;s opportunities
        </p>
        <ul className="space-y-1.5">
          {opportunities.map((op) => (
            <li
              key={op.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground">{op.label}</span>
                <span className="text-[11px] font-bold text-emerald-700">+{op.ghc} GHC</span>
              </span>
              {op.done ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  <Check size={12} /> Done
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => op.action?.()}
                  className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold text-background"
                >
                  {op.cta}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 px-0.5 text-[10px] leading-relaxed text-muted-foreground">
          Rewards favour quality and trust — not spam. Likes, empty comments, and mass follows
          do not farm GHC. Daily caps and validation protect the economy.
        </p>
      </section>
    </div>
  )
}
