"use client"

/**
 * Home/Feed Daily Reward experience
 * — Compact bottom sheet available from the feed card / Rewards Centre
 * — Claimable feed control is a compact pill (not a rectangular demo card)
 * — Claim history / streak details live in Rewards Centre, not on the feed
 * — One claim per Africa/Lagos reward day
 * — Membership-aware track + streak shields
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronRight, Gift, X, Sparkles, Check, Shield } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import { getBoundDomainServices } from "@/lib/domains/compat"
import {
  getDailyStreak,
  claimDailyStreak,
  markDailyClaimedForUi,
  markDailyRewardDismissed,
  msUntilNextLagosMidnight,
  lagosDayKey,
  formatCountdown,
  trackForTier,
  ghcForCycleDay,
  type MembershipTierForTrack,
} from "@/lib/domains/reward-level-domain"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { notifyRewardClaimed } from "@/lib/notifications"
import { IdentityService } from "@/lib/identity/identity-service"
import type { Profile } from "@/lib/ghc-types"
import { useDailyClaimStatus } from "./use-daily-claim-status"
import { postDailyClaim } from "@/lib/rewards/claim-daily-client"

function resolveUserId(profile?: Profile | null): string {
  const fromIdentity = IdentityService.getCurrentUserId()
  if (fromIdentity && fromIdentity !== "current-user" && fromIdentity !== "anonymous") {
    return fromIdentity
  }
  try {
    const id = String(profile?.id || "").trim()
    if (id && id !== "current-user" && id !== "anonymous") return id
  } catch {
    /* */
  }
  return IdentityService.getCurrentUserId() || "current-user"
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
  const ghc = useGHC()
  const userId = resolveUserId(ghc.profile)
  const tier = resolveTier()
  const [tick, setTick] = useState<number>(0)
  const [claiming, setClaiming] = useState(false)
  const [justClaimedFlash, setJustClaimedFlash] = useState(false)
  const claimInFlightRef = useRef(false)
  const { status: serverStatus, revision: statusRevision, refresh: refreshServerStatus } = useDailyClaimStatus(userId)
  const [countdownLabel, setCountdownLabel] = useState(() => formatCountdown(msUntilNextLagosMidnight()))
  useEffect(() => {
    const id = window.setInterval(() => setCountdownLabel(formatCountdown(msUntilNextLagosMidnight())), 1000)
    return () => window.clearInterval(id)
  }, [])

  const localDaily = useMemo(() => {
    void tick
    void refreshKey
    void statusRevision
    return getDailyStreak(userId, tier)
  }, [userId, tier, tick, refreshKey, statusRevision])
  const daily = useMemo(() => {
    // Local browser state can lag behind a server-side claim day (e.g. after
    // reinstall, another device, or a stale tab). Until the server confirms
    // today's status, keep the claim visible. The POST endpoint is idempotent,
    // so a repeat attempt cannot mint a second reward.
    if (!serverStatus || serverStatus.dayKey !== localDaily.rewardDayKey) {
      const previewDay = Math.max(1, Math.min(7, localDaily.displayCycleDay || 1))
      return {
        ...localDaily,
        canClaimToday: true,
        displayCycleDay: previewDay,
        todayGhc: Math.max(0, localDaily.todayGhc || ghcForCycleDay(previewDay, tier)),
      }
    }
    const cycleDay = serverStatus.cycleDay
    return {
      ...localDaily,
      canClaimToday: serverStatus.claimable,
      displayCycleDay: cycleDay,
      todayGhc: serverStatus.claimable ? ghcForCycleDay(cycleDay, tier) : 0,
    }
  }, [localDaily, serverStatus, tier])

  const handleClaim = useCallback(async () => {
    if (claimInFlightRef.current || claiming || !daily.canClaimToday) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      ghc.addToast?.("You are offline — claim when reconnected", "info")
      return
    }
    claimInFlightRef.current = true
    setClaiming(true)
    try {
      // Server is authoritative — never optimistically credit from client preview
      const server = await postDailyClaim()
      if (!server.ok) {
        ghc.addToast?.(server.error || "Claim failed — your reward is still available to retry", "error")
        void refreshServerStatus()
        setJustClaimedFlash(true)
      window.setTimeout(() => setJustClaimedFlash(false), 4000)
      setTick((t) => t + 1)
        return
      }
      // Only advance local streak/XP after a newly completed server claim.
      // An idempotent repeat marks the day locally but must not award XP twice.
      const res = server.alreadyClaimed
        ? (markDailyClaimedForUi(userId), {
            ok: true,
            ghc: 0,
            xp: 0,
            streakDays: daily.streakDays,
            cycleDay: server.cycleDay ?? daily.displayCycleDay,
          })
        : claimDailyStreak(userId, tier)
      const amt = server.serverAmount ?? res.ghc ?? daily.todayGhc
      const day = server.cycleDay ?? res.cycleDay ?? daily.displayCycleDay
      const redemptionNote = server.redeemableAt && Number.isFinite(Date.parse(server.redeemableAt)) ? ` · redeemable ${new Date(server.redeemableAt).toLocaleString()}` : ""
      const shieldNote = res.usedShield ? " · Streak Shield used" : ""
      // Re-hydrate wallet from server ledger — never optimistically add GHC
      try {
        const { syncWalletAfterServerClaim } = await import(
          "@/lib/domains/adapters/wallet-sync-after-claim"
        )
        await syncWalletAfterServerClaim({
          userId,
          claimedAmount: null,
          alreadyClaimed: server.alreadyClaimed,
          referenceId: `daily_checkin:${userId}:${daily.rewardDayKey}`,
        })
      } catch {
        /* keep last known balance; do not fabricate */
      }
      ghc.addToast?.(
        server.alreadyClaimed
          ? `Already claimed · ${amt} GHC pending${redemptionNote}`
          : `${amt} GHC claimed and pending for 48 hours${redemptionNote} · Day ${day}/7 · +${res.xp || 0} XP${shieldNote}`,
        "success"
      )
      setTick((t) => t + 1)
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:daily-reward-claimed", {
            detail: {
              ...res,
              ghc: amt,
              cycleDay: day,
              server: true,
              serverAmount: server.serverAmount,
              pending: server.pending !== false,
              redeemableAt: server.redeemableAt,
              alreadyClaimed: server.alreadyClaimed,
            },
          })
        )
        if (!server.alreadyClaimed && amt) {
          try {
            notifyRewardClaimed({
              message: `Day ${day}/7 claim pending for 48 hours · ₲ ${Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              amountLabel: String(amt),
            })
          } catch { /* */ }
        }
      } catch {
        /* */
      }
    } finally {
      claimInFlightRef.current = false
      setClaiming(false)
    }
  }, [claiming, daily.canClaimToday, daily.rewardDayKey, daily.todayGhc, daily.displayCycleDay, daily.streakDays, userId, tier, ghc, refreshServerStatus])

  // After claim: compact status pill only (no long rectangular prototype card).
  if (!daily.canClaimToday) {
    return (
      <div
        className="mx-1 flex items-center gap-2.5 rounded-full border border-emerald-200/70 bg-emerald-50/90 px-3 py-2 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40"
        role="status"
        aria-label="Daily GHC reward already claimed"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-inner">
          <Gift size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-emerald-950 dark:text-emerald-50">{justClaimedFlash ? "Claimed — pending 48h" : "GHC daily claimed"}</p>
          <p className="text-[10px] tabular-nums text-emerald-900/70 dark:text-emerald-200/70">
            Next in <span className="font-semibold">{countdownLabel}</span>
          </p>
        </div>
        {onOpenFull ? (
          <button
            type="button"
            onClick={onOpenFull}
            className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-900/60 dark:text-emerald-100 dark:ring-emerald-800"
          >
            Details
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="mx-1 overflow-hidden rounded-full border border-emerald-500/25 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 p-[1px] shadow-md shadow-emerald-700/20"
      aria-label="Claim daily GHC reward"
    >
      <div className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 px-2.5 py-2 pl-2 text-white">
        <button
          type="button"
          disabled={claiming}
          onClick={() => void handleClaim()}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40 transition active:scale-95 disabled:opacity-60"
          aria-label={claiming ? "Claiming daily reward" : `Claim ${daily.todayGhc} GHC`}
        >
          {claiming ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <GhcCoinIcon size={26} />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-400 px-1.5 text-[9px] font-black leading-4 text-amber-950">
            {daily.displayCycleDay}/7
          </span>
        </button>
        <button
          type="button"
          disabled={claiming}
          onClick={() => void handleClaim()}
          className="min-w-0 flex-1 text-left disabled:opacity-70"
        >
          <p className="text-[13px] font-bold leading-tight tracking-tight">
            Claim {daily.todayGhc} GHC
          </p>
          <p className="text-[10px] font-medium text-white/80">
            Daily utility · Day {daily.displayCycleDay}/7 · not Pi
          </p>
        </button>
        <button
          type="button"
          disabled={claiming}
          onClick={() => void handleClaim()}
          className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-emerald-800 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {claiming ? "…" : "Claim"}
        </button>
        {onOpenFull ? (
          <button
            type="button"
            onClick={onOpenFull}
            className="shrink-0 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Open reward details"
          >
            <ChevronRight size={18} />
          </button>
        ) : null}
      </div>
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
  const ghc = useGHC()
  const userId = resolveUserId(ghc.profile)
  const tier = resolveTier()
  const [claiming, setClaiming] = useState(false)
  const claimInFlightRef = useRef(false)
  const { status: serverStatus, revision: statusRevision, refresh: refreshServerStatus } = useDailyClaimStatus(userId, open)

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:daily-reward-sheet-visibility", { detail: { open } }))
    } catch {
      /* non-browser render */
    }
    return () => {
      try {
        window.dispatchEvent(new CustomEvent("ghc:daily-reward-sheet-visibility", { detail: { open: false } }))
      } catch {
        /* non-browser render */
      }
    }
  }, [open])
  const localDaily = useMemo(() => {
    // Recompute when sheet opens so claimability is current
    void open
    void statusRevision
    return getDailyStreak(userId, tier)
  }, [userId, tier, open, statusRevision])
  const daily = useMemo(() => {
    // Local browser state can lag behind a server-side claim day (e.g. after
    // reinstall, another device, or a stale tab). Until the server confirms
    // today's status, keep the claim visible. The POST endpoint is idempotent,
    // so a repeat attempt cannot mint a second reward.
    if (!serverStatus || serverStatus.dayKey !== localDaily.rewardDayKey) {
      const previewDay = Math.max(1, Math.min(7, localDaily.displayCycleDay || 1))
      return {
        ...localDaily,
        canClaimToday: true,
        displayCycleDay: previewDay,
        todayGhc: Math.max(0, localDaily.todayGhc || ghcForCycleDay(previewDay, tier)),
      }
    }
    const cycleDay = serverStatus.cycleDay
    return {
      ...localDaily,
      canClaimToday: serverStatus.claimable,
      displayCycleDay: cycleDay,
      todayGhc: serverStatus.claimable ? ghcForCycleDay(cycleDay, tier) : 0,
    }
  }, [localDaily, serverStatus, tier])

  const handleClaim = useCallback(async () => {
    if (claimInFlightRef.current || claiming || !daily.canClaimToday) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      ghc.addToast?.("You are offline — claim when reconnected", "info")
      return
    }
    claimInFlightRef.current = true
    setClaiming(true)
    try {
      const server = await postDailyClaim()
      if (!server.ok) {
        ghc.addToast?.(server.error || "Claim failed — your reward is still available to retry", "error")
        void refreshServerStatus()
        return
      }
      const res = server.alreadyClaimed
        ? (markDailyClaimedForUi(userId), {
            ok: true,
            ghc: 0,
            xp: 0,
            streakDays: daily.streakDays,
            cycleDay: server.cycleDay ?? daily.displayCycleDay,
          })
        : claimDailyStreak(userId, tier)
      const amt = server.serverAmount ?? res.ghc ?? daily.todayGhc
      const day = server.cycleDay ?? res.cycleDay
      const redemptionNote = server.redeemableAt && Number.isFinite(Date.parse(server.redeemableAt)) ? ` · redeemable ${new Date(server.redeemableAt).toLocaleString()}` : ""
      const shieldNote = res.usedShield ? " · Streak Shield protected your streak" : ""
      try {
        const { syncWalletAfterServerClaim } = await import(
          "@/lib/domains/adapters/wallet-sync-after-claim"
        )
        await syncWalletAfterServerClaim({
          userId,
          claimedAmount: null,
          alreadyClaimed: server.alreadyClaimed,
          referenceId: `daily_checkin:${userId}:${daily.rewardDayKey}`,
        })
      } catch {
        /* last known balance only */
      }
      ghc.addToast?.(
        server.alreadyClaimed
          ? `Already claimed · ${amt} GHC pending${redemptionNote}`
          : `${amt} GHC claimed and pending for 48 hours${redemptionNote} · Day ${day}/7 · +${res.xp || 0} XP${shieldNote}`,
        "success"
      )
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:daily-reward-claimed", {
            detail: {
              ...res,
              ghc: amt,
              server: true,
              serverAmount: server.serverAmount,
              pending: server.pending !== false,
              redeemableAt: server.redeemableAt,
              alreadyClaimed: server.alreadyClaimed,
            },
          })
        )
      } catch {
        /* */
      }
      onClaimed?.()
      onClose()
    } finally {
      claimInFlightRef.current = false
      setClaiming(false)
    }
  }, [claiming, daily.canClaimToday, daily.todayGhc, daily.displayCycleDay, daily.rewardDayKey, daily.streakDays, userId, tier, ghc, onClose, onClaimed, refreshServerStatus])

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
                Your Daily GHC Reward is ready
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
              Once every 24h · next day {daily.nextDayPreview} GHC · 00:00 Africa/Lagos
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
            {claiming ? "Claiming…" : `Claim GHC · ${daily.todayGhc} GHC`}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2 text-center text-[12px] font-semibold text-muted-foreground"
          >
            Maybe later
          </button>
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
            GHC daily utility only · once per Lagos day · not Pi Network cashback
          </p>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  )
}

/** Feed-level controller: delayed sheet + card */
export function DailyRewardHomeExperience() {
  const ghc = useGHC()
  const userId = resolveUserId(ghc.profile)
  const tier = resolveTier()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState<number>(0)

  // DailyClaimPrompt owns the single automatic popup. The feed card and Rewards
  // Centre remain manual entry points for this detailed sheet.

  useEffect(() => {
    let observedDay = lagosDayKey()
    const checkRewardDay = () => {
      const currentDay = lagosDayKey()
      if (currentDay !== observedDay) {
        observedDay = currentDay
        setRefreshKey((key) => key + 1)
      }
    }
    const id = window.setInterval(checkRewardDay, 30_000)
    window.addEventListener("focus", checkRewardDay)
    document.addEventListener("visibilitychange", checkRewardDay)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("focus", checkRewardDay)
      document.removeEventListener("visibilitychange", checkRewardDay)
    }
  }, [])

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
