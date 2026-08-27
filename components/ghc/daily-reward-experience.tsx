"use client"

/**
 * Home/Feed Daily Reward experience
 * — Premium bottom sheet after short delay when claimable
 * — Claimable feed card only while reward is available (hidden after claim)
 * — Claim history / streak details live in Rewards Centre, not on the feed
 * — One claim per Africa/Lagos reward day
 * — Membership-aware track + streak shields
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Gift, X, Sparkles, Check, Shield } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { getBoundDomainServices } from "@/lib/domains/compat"
import {
  getDailyStreak,
  claimDailyStreak,
  markDailyRewardDismissed,
  wasDailyRewardDismissed,
  trackForTier,
  type MembershipTierForTrack,
} from "@/lib/domains/reward-level-domain"
import { GhcCoinIcon } from "./ghc-coin-icon"

function resolveUserId(profile?: Record<string, unknown> | null): string {
  return (
    (profile?.id as string) ||
    (profile?.userId as string) ||
    "current-user"
  )
}

function resolveTier(): MembershipTierForTrack {
  try {
    const st = getBoundDomainServices()?.membership?.getStatus?.() as
      | { tier?: string }
      | null
      | undefined
    const t = String(st?.tier || "free").toLowerCase()
    if (t === "vvip") return "vvip"
    if (t === "vip") return "vip"
  } catch {
    /* */
  }
  return "free"
}

async function creditDailyToWallet(
  userId: string,
  amount: number,
  cycleDay: number,
  rewardDayKey: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const eco = getBoundDomainServices()?.economy as {
      evaluateReward?: (input: {
        sourceEvent: string
        referenceId?: string
        metadata?: Record<string, unknown>
      }) => Promise<{
        ok: boolean
        data?: { rewards?: Array<{ id: string; amount: number }> }
        error?: string
      }>
      claimReward?: (id: string) => Promise<{ ok: boolean; error?: string }>
    } | null

    if (!eco?.evaluateReward) {
      return { ok: true } // streak state already recorded; ledger optional offline
    }

    const ref = `daily_checkin:${userId}:${rewardDayKey}`
    const evaluated = await eco.evaluateReward({
      sourceEvent: "DAILY_CHECKIN",
      referenceId: ref,
      metadata: { cycleDay, intendedAmount: amount },
    })

    if (!evaluated?.ok) {
      // Already rewarded today is fine (idempotent)
      if (String(evaluated?.error || "").toLowerCase().includes("duplicate")) {
        return { ok: true }
      }
      // Continue — streak is source of truth for UI; wallet may sync later
      return { ok: true, error: evaluated?.error }
    }

    const rewards = evaluated.data?.rewards || []
    for (const r of rewards) {
      if (eco.claimReward) {
        await eco.claimReward(r.id)
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: true,
      error: e instanceof Error ? e.message : "Wallet sync deferred",
    }
  }
}

/** Compact progress strip: 1 ✓ — 2 ● — 3 … — 7 🎁 */
function StreakProgressStrip({
  cycleDay,
  claimedToday,
  tier,
}: {
  cycleDay: number
  claimedToday: boolean
  tier: MembershipTierForTrack
}) {
  const track = trackForTier(tier)
  const active = claimedToday ? cycleDay : Math.max(0, cycleDay - 1)
  return (
    <div className="flex items-center justify-between gap-1 px-0.5">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const done = d <= active
        const isNext = !claimedToday && d === cycleDay
        const isBonus = d === 7
        return (
          <div key={d} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition ${
                done
                  ? "bg-emerald-600 text-white"
                  : isNext
                    ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400 dark:bg-amber-950 dark:text-amber-100"
                    : "bg-muted text-muted-foreground"
              }`}
              aria-label={`Day ${d}${done ? " claimed" : isNext ? " ready" : ""}`}
            >
              {done ? <Check size={14} strokeWidth={3} /> : isBonus ? "🎁" : d}
            </div>
            <span className="truncate text-[9px] font-semibold text-muted-foreground">
              {track[d]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function DailyRewardFeedCard({
  onOpenFull,
  refreshKey = 0,
}: {
  onOpenFull?: () => void
  refreshKey?: number
}) {
  const ghc = useGHC() as {
    profile?: Record<string, unknown>
    addToast?: (message: string, type?: string) => void
  }
  const userId = resolveUserId(ghc.profile)
  const tier = resolveTier()
  const [tick, setTick] = useState(0)
  const [claiming, setClaiming] = useState(false)

  const daily = useMemo(() => {
    void tick
    void refreshKey
    return getDailyStreak(userId, tier)
  }, [userId, tier, tick, refreshKey])

  const handleClaim = useCallback(async () => {
    if (claiming || !daily.canClaimToday) return
    setClaiming(true)
    try {
      const res = claimDailyStreak(userId, tier)
      if (!res.ok) {
        ghc.addToast?.(res.error || "Already claimed", "error")
        setTick((t) => t + 1)
        return
      }
      await creditDailyToWallet(userId, res.ghc, res.cycleDay, daily.rewardDayKey)
      const shieldNote = res.usedShield ? " · Streak Shield used" : ""
      ghc.addToast?.(
        `+${res.ghc} GHC · Day ${res.cycleDay}/7 · +${res.xp} XP${shieldNote}`,
        "success"
      )
      setTick((t) => t + 1)
      try {
        window.dispatchEvent(new CustomEvent("ghc:daily-reward-claimed", { detail: res }))
      } catch {
        /* */
      }
    } finally {
      setClaiming(false)
    }
  }, [claiming, daily.canClaimToday, daily.rewardDayKey, userId, tier, ghc])

  // Feed only shows the card while a claim is still available.
  // After claim, hide entirely — streak / history live in Rewards Centre.
  if (!daily.canClaimToday) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-card to-amber-50/40 shadow-sm dark:border-emerald-900 dark:from-emerald-950/40 dark:to-card">
      <div className="flex items-stretch gap-3 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
          <Gift size={22} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Daily reward · Day {daily.displayCycleDay}/7
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
            <GhcCoinIcon size={16} />
            {daily.todayGhc} GHC waiting
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Next: {daily.nextDayPreview} GHC · keep your streak
          </p>
        </div>
        <button
          type="button"
          disabled={claiming}
          onClick={() => void handleClaim()}
          className="shrink-0 self-center rounded-full bg-emerald-700 px-3.5 py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
        >
          {claiming ? "…" : "Claim"}
        </button>
      </div>
      <div className="border-t border-emerald-100/80 px-3 py-2 dark:border-emerald-900/50">
        <StreakProgressStrip
          cycleDay={daily.displayCycleDay}
          claimedToday={false}
          tier={tier}
        />
      </div>
      {onOpenFull ? (
        <button
          type="button"
          onClick={onOpenFull}
          className="w-full border-t border-emerald-100/80 py-1.5 text-center text-[10px] font-semibold text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300"
        >
          Open full reward
        </button>
      ) : null}
    </div>
  )
}

export function DailyRewardSheet({
  open,
  onClose,
  onClaimed,
}: {
  open: boolean
  onClose: () => void
  onClaimed?: () => void
}) {
  const ghc = useGHC() as {
    profile?: Record<string, unknown>
    addToast?: (message: string, type?: string) => void
  }
  const userId = resolveUserId(ghc.profile)
  const tier = resolveTier()
  const [claiming, setClaiming] = useState(false)
  const daily = useMemo(() => getDailyStreak(userId, tier), [userId, tier, open])

  const handleClaim = useCallback(async () => {
    if (claiming || !daily.canClaimToday) return
    setClaiming(true)
    try {
      const res = claimDailyStreak(userId, tier)
      if (!res.ok) {
        ghc.addToast?.(res.error || "Already claimed", "error")
        onClose()
        return
      }
      await creditDailyToWallet(userId, res.ghc, res.cycleDay, daily.rewardDayKey)
      const shieldNote = res.usedShield ? " · Streak Shield protected your streak" : ""
      ghc.addToast?.(
        `+${res.ghc} GHC added · Day ${res.cycleDay}/7 · +${res.xp} XP${shieldNote}`,
        "success"
      )
      try {
        window.dispatchEvent(new CustomEvent("ghc:daily-reward-claimed", { detail: res }))
      } catch {
        /* */
      }
      onClaimed?.()
      onClose()
    } finally {
      setClaiming(false)
    }
  }, [claiming, daily.canClaimToday, daily.rewardDayKey, userId, tier, ghc, onClose, onClaimed])

  const handleDismiss = useCallback(() => {
    markDailyRewardDismissed(userId)
    onClose()
  }, [userId, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-reward-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Dismiss daily reward"
        onClick={handleDismiss}
      />
      <div className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom-4 duration-300 rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl sm:mx-4">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Sparkles size={16} />
            </span>
            <div>
              <p id="daily-reward-title" className="text-sm font-bold text-foreground">
                Your daily GreenHaven reward
              </p>
              <p className="text-[11px] text-muted-foreground">
                Day {daily.displayCycleDay} of 7 · {tier === "free" ? "Member" : tier.toUpperCase()} track
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-600/30">
              <GhcCoinIcon size={40} />
              <span className="absolute -bottom-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950">
                DAY {daily.displayCycleDay}
              </span>
            </div>
            <p className="text-3xl font-black tracking-tight text-foreground">
              +{daily.todayGhc}{" "}
              <span className="text-lg font-bold text-emerald-700">GHC</span>
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Keep your streak alive · next day {daily.nextDayPreview} GHC
            </p>
          </div>

          <StreakProgressStrip
            cycleDay={daily.displayCycleDay}
            claimedToday={false}
            tier={tier}
          />

          {daily.shieldsRemaining > 0 ? (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Shield size={12} className="text-emerald-600" />
              {daily.shieldsRemaining} streak shield
              {daily.shieldsRemaining === 1 ? "" : "s"} this month
            </p>
          ) : null}

          <button
            type="button"
            disabled={claiming || !daily.canClaimToday}
            onClick={() => void handleClaim()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-[15px] font-bold text-white shadow-md shadow-emerald-700/25 transition hover:bg-emerald-800 disabled:opacity-60"
          >
            <Gift size={18} />
            {claiming ? "Claiming…" : `Claim ${daily.todayGhc} GHC`}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2 text-center text-[12px] font-semibold text-muted-foreground"
          >
            Maybe later
          </button>
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
            One claim per day · resets 00:00 Africa/Lagos · GHC is in-app utility, not Pi
          </p>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  )
}

/** Feed-level controller: delayed sheet + card */
export function DailyRewardHomeExperience() {
  const ghc = useGHC() as { profile?: Record<string, unknown> }
  const userId = resolveUserId(ghc.profile)
  const tier = resolveTier()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const daily = getDailyStreak(userId, tier)
    if (!daily.canClaimToday) return
    if (wasDailyRewardDismissed(userId)) return
    const t = window.setTimeout(() => setSheetOpen(true), 1600)
    return () => window.clearTimeout(t)
  }, [userId, tier])

  useEffect(() => {
    const onClaimed = () => setRefreshKey((k) => k + 1)
    window.addEventListener("ghc:daily-reward-claimed", onClaimed)
    return () => window.removeEventListener("ghc:daily-reward-claimed", onClaimed)
  }, [])

  return (
    <>
      <DailyRewardFeedCard
        refreshKey={refreshKey}
        onOpenFull={() => setSheetOpen(true)}
      />
      <DailyRewardSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onClaimed={() => setRefreshKey((k) => k + 1)}
      />
    </>
  )
}
