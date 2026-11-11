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
  ChevronRight, X, Check, Shield, Clock } from "lucide-react"
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
        return
      }
      // Only advance local streak/XP after a newly completed server claim.
      // An idempotent repeat marks the day locally but must not award XP twice.
      const res: ReturnType<typeof claimDailyStreak> = server.alreadyClaimed
        ? (markDailyClaimedForUi(userId), {
            ok: true,
            ghc: 0,
            xp: 0,
            streakDays: daily.streakDays,
            cycleDay: server.cycleDay ?? daily.displayCycleDay,
          })
        : claimDailyStreak(userId, tier)
      // Only the server may state the credited amount. Local streak values are
      // progression hints, not a financial amount to display as awarded.
      const amt = server.serverAmount
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
          ? "Daily reward was already claimed. Wallet status is being refreshed."
          : amt != null
            ? `${amt} GHC claim confirmed and pending for 48 hours${redemptionNote} · Day ${day}/7 · +${res.xp || 0} XP${shieldNote}`
            : `Daily claim confirmed by the server · Day ${day}/7. The credited amount will appear after the Wallet refresh.`,
        "success"
      )
      setTick((t) => t + 1)
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:daily-reward-claimed", {
            detail: {
              ...res,
              ghc: amt ?? null,
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
  }, [claiming, daily.canClaimToday, daily.rewardDayKey, daily.displayCycleDay, daily.streakDays, userId, tier, ghc, refreshServerStatus])

  // Premium daily bonus card — the official GHC coin is the visual anchor.
  if (!daily.canClaimToday) {
    return (
      <section className="gh-daily-feed-card gh-daily-feed-card-complete" aria-label="Daily GHC reward claimed">
        <div className="gh-daily-feed-card-top"><span className="gh-daily-feed-kicker">GREENHAVEN DAILY REWARDS</span><span className="gh-daily-feed-status"><Check size={12} /> CLAIMED</span></div>
        <div className="gh-daily-feed-main">
          <div className="gh-daily-feed-coin"><GhcCoinIcon size={54} /></div>
          <div className="min-w-0 flex-1"><p className="text-[15px] font-black text-foreground">Your daily reward is secured</p><p className="mt-1 text-[11px] text-muted-foreground">Your next check-in opens in <strong className="text-emerald-700 dark:text-emerald-300">{countdownLabel}</strong>.</p></div>
          {onOpenFull ? <button type="button" onClick={onOpenFull} className="gh-daily-feed-secondary">Journey <ChevronRight size={14} /></button> : null}
        </div>
        <div className="gh-daily-feed-footer"><span>7-day consistency journey</span><span>Day {daily.displayCycleDay}/7</span></div>
        <div className="gh-daily-feed-progress"><span style={{ width: `${Math.min(100, Math.max(0, daily.displayCycleDay / 7 * 100))}%` }} /></div>
      </section>
    )
  }

  return (
    <section className="gh-daily-feed-card" aria-label="Claim daily GHC reward">
      <div className="gh-daily-feed-card-top"><span className="gh-daily-feed-kicker">GREENHAVEN DAILY REWARDS</span><span className="gh-daily-feed-status gh-daily-feed-status-ready"><span /> READY TO CLAIM</span></div>
      <div className="gh-daily-feed-main">
        <div className="gh-daily-feed-coin gh-daily-feed-coin-ready"><GhcCoinIcon size={58} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Day {daily.displayCycleDay} reward preview</p>
          <p className="mt-0.5 text-[27px] font-black leading-none tracking-tight text-foreground">{daily.todayGhc.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[13px] font-extrabold text-emerald-700 dark:text-emerald-300">GHC</span></p>
          <p className="mt-1 text-[10px] text-muted-foreground">Final amount confirmed by GreenHaven</p>
        </div>
        <button type="button" disabled={claiming} onClick={() => void handleClaim()} className="gh-daily-feed-claim" aria-label={claiming ? "Claiming daily GHC reward" : `Claim ${daily.todayGhc} GHC`}>
          {claiming ? <span className="gh-daily-premium-spinner" /> : "Claim"}
          {!claiming ? <span aria-hidden>→</span> : null}
        </button>
      </div>
      <div className="gh-daily-feed-journey">
        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-foreground">Your 7-day streak</span><span className="text-[10px] text-muted-foreground">{daily.displayCycleDay} of 7</span></div>
        <div className="mt-2 grid grid-cols-7 gap-1.5" aria-label="Seven day reward progress">
          {Array.from({ length: 7 }, (_, index) => { const day = index + 1; const current = day === daily.displayCycleDay; const past = day < daily.displayCycleDay; return <span key={day} className={`gh-daily-feed-day ${past ? "is-past" : current ? "is-current" : ""}`} aria-label={`Day ${day}${past ? " passed" : current ? " current" : " upcoming"}`}>{past ? "✓" : day}</span> })}
        </div>
      </div>
      <div className="gh-daily-feed-bottom"><span><Shield size={12} /> Server verified · 48-hour maturity · Reset in {countdownLabel}</span>{onOpenFull ? <button type="button" onClick={onOpenFull} className="gh-daily-feed-link">View details <ChevronRight size={13} /></button> : null}</div>
      {claiming ? <p className="mt-2 text-center text-[10px] font-semibold text-emerald-700 dark:text-emerald-300" role="status">Confirming your claim securely…</p> : null}
    </section>
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
      const res: ReturnType<typeof claimDailyStreak> = server.alreadyClaimed
        ? (markDailyClaimedForUi(userId), {
            ok: true,
            ghc: 0,
            xp: 0,
            streakDays: daily.streakDays,
            cycleDay: server.cycleDay ?? daily.displayCycleDay,
          })
        : claimDailyStreak(userId, tier)
      // Financial amount is server-reported only; never substitute local preview.
      const amt = server.serverAmount
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
          ? "Daily reward was already claimed. Wallet status is being refreshed."
          : amt != null
            ? `${amt} GHC claim confirmed and pending for 48 hours${redemptionNote} · Day ${day}/7 · +${res.xp || 0} XP${shieldNote}`
            : `Daily claim confirmed by the server · Day ${day}/7. The credited amount will appear after the Wallet refresh.`,
        "success"
      )
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:daily-reward-claimed", {
            detail: {
              ...res,
              ghc: amt ?? null,
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
  }, [claiming, daily.canClaimToday, daily.displayCycleDay, daily.rewardDayKey, daily.streakDays, userId, tier, ghc, onClose, onClaimed, refreshServerStatus])

  const handleDismiss = useCallback(() => {
    if (claimInFlightRef.current || claiming) return
    markDailyRewardDismissed(userId)
    onClose()
  }, [claiming, userId, onClose])

  if (!open) return null

  return (
    <div className="gh-daily-sheet-overlay fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="daily-reward-title">
      <button type="button" disabled={claiming} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait" aria-label="Dismiss daily reward" onClick={handleDismiss} />
      <div className="gh-daily-sheet-card relative z-10 w-full max-w-lg sm:mx-4">
        <header className="gh-daily-sheet-header">
          <div className="min-w-0"><span className="gh-daily-eyebrow"><span className="gh-daily-live-dot" /> GREENHAVEN DAILY REWARDS</span><h2 id="daily-reward-title" className="mt-1 text-lg font-black tracking-tight text-white">Your next streak milestone starts here</h2><p className="mt-1 text-[11px] text-emerald-50/75">A consistent check-in keeps your seven-day reward journey moving.</p></div>
          <button type="button" onClick={handleDismiss} disabled={claiming} className="gh-daily-premium-close" aria-label="Close"><X size={18} /></button>
        </header>
        <div className="gh-daily-sheet-content">
          <div className="gh-daily-sheet-hero">
            <div className="gh-daily-coin-stage"><span className="gh-daily-coin-orbit gh-daily-coin-orbit-one" /><span className="gh-daily-coin-orbit gh-daily-coin-orbit-two" /><span className="gh-daily-coin-disc"><GhcCoinIcon size={84} className="gh-daily-official-coin" /></span><span className="gh-daily-day-chip">DAY {daily.displayCycleDay} / 7</span></div>
            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">{daily.canClaimToday ? "Today's reward preview" : "Today's reward is secured"}</p>
            {daily.canClaimToday ? <><p className="mt-1 text-4xl font-black tracking-tight text-foreground">{daily.todayGhc.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">GHC</span></p><p className="mt-1 text-[11px] text-muted-foreground">Preview only — server confirms the credited amount.</p></> : <p className="mt-1 text-[13px] font-bold text-foreground">Next check-in opens at 00:00 Africa/Lagos</p>}
          </div>
          <div className="gh-daily-streak-panel">
            <div className="flex items-center justify-between"><div><p className="text-[12px] font-extrabold text-foreground">7-day consistency journey</p><p className="text-[10px] text-muted-foreground">Your current reward cycle</p></div><span className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">{daily.displayCycleDay}/7</span></div>
            <StreakProgressStrip cycleDay={daily.displayCycleDay} claimedToday={!daily.canClaimToday} tier={tier} />
          </div>
          {daily.shieldsRemaining > 0 ? <div className="gh-daily-info-tile"><Shield size={15} /><span><strong>{daily.shieldsRemaining} streak shield{daily.shieldsRemaining === 1 ? "" : "s"} available</strong><small>Helps protect eligible streak continuity</small></span></div> : null}
          <div className="grid grid-cols-2 gap-2"><div className="gh-daily-info-tile"><Shield size={15} /><span><strong>Ledger-backed</strong><small>Verified by GreenHaven</small></span></div><div className="gh-daily-info-tile"><Clock size={15} /><span><strong>48-hour maturity</strong><small>Pending is not spendable</small></span></div></div>
          {daily.canClaimToday ? <button type="button" disabled={claiming} onClick={() => void handleClaim()} className="gh-daily-premium-cta">{claiming ? <><span className="gh-daily-premium-spinner" /> Securing your reward…</> : <><GhcCoinIcon size={25} /> Claim {daily.todayGhc.toLocaleString(undefined, { maximumFractionDigits: 2 })} GHC <span aria-hidden>→</span></>}</button> : <div className="gh-daily-maturity-card"><Check size={17} /><span><strong>Daily check-in completed</strong><small>Your next daily reward becomes available at the next Lagos reward-day reset.</small></span></div>}
          <button type="button" onClick={handleDismiss} disabled={claiming} className="w-full py-2 text-center text-[11px] font-bold text-muted-foreground">{daily.canClaimToday ? "Maybe later" : "Close"}</button>
          <p className="text-center text-[9px] leading-relaxed text-muted-foreground">Daily GHC utility only · separate from Pi Network cashback and Pi payments.</p>
        </div>
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
