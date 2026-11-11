"use client"

/**
 * Pi-style daily GHC claim:
 * - Golden lightning + GHC coin FAB portaled to document.body (never clipped by headers).
 * - Mid-right of the viewport on every screen until claimed.
 * - Sheet opens only when the user taps the FAB (or ghc:open-daily-claim from Rewards).
 * - Does not inject banners into page headers.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Zap, Shield, Clock } from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { useGHCProfile } from "@/contexts/ghc-context"
import { useDailyClaimStatus } from "./use-daily-claim-status"
import { notifyRewardClaimed } from "@/lib/notifications"
import { postDailyClaim } from "@/lib/rewards/claim-daily-client"
import { markDailyClaimedForUi, ghcForCycleDay } from "@/lib/domains/reward-level-domain"
import { useSessionLock } from "@/contexts/session-lock-context"

type DoneState = {
  amount?: number
  redeemableAt?: string
  pending: boolean
  alreadyClaimed: boolean
}

function formatAmount(amount?: number) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "GHC"
  return `+${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} GHC`
}

function formatRedeemable(iso?: string) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return null
  }
}

export function DailyClaimPrompt() {
  const { profile } = useGHCProfile()
  const { isLocked } = useSessionLock()
  const userId = profile?.id || ""
  const { status, refresh } = useDailyClaimStatus(userId)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const claimInFlightRef = useRef(false)
  const [done, setDone] = useState<DoneState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState(false)
  const sheetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (userId) void refresh()
  }, [userId, refresh])

  const claimedToday = Boolean(status?.claimedToday)
  // Prefer server claimable; keep FAB while status is still loading so the entry point never vanishes.
  const serverClaimable = status?.claimable === true
  const loadingStatus = status === null
  const canAttemptClaim = Boolean(userId && !claimedToday && (loadingStatus || status?.claimable !== false))
  const claimable = Boolean(userId && !claimedToday && (serverClaimable || loadingStatus))
  const cycleDay =
    typeof status?.cycleDay === "number" && status.cycleDay > 0 ? status.cycleDay : null
  const tier =
    (profile as { membershipTier?: string; tier?: string } | null)?.membershipTier ||
    (profile as { tier?: string } | null)?.tier
  const previewAmount = cycleDay != null ? ghcForCycleDay(cycleDay, tier) : undefined

  useEffect(() => {
    if (claimable) setDone(null)
  }, [claimable, status?.dayKey])

  // Hint bubble once per session when claimable
  useEffect(() => {
    if (!claimable || claimedToday) return
    try {
      if (sessionStorage.getItem("ghc.dailyClaimHintShown") === "1") return
      sessionStorage.setItem("ghc.dailyClaimHintShown", "1")
      setHint(true)
      const t = window.setTimeout(() => setHint(false), 10000)
      return () => window.clearTimeout(t)
    } catch {
      /* private mode */
    }
  }, [claimable, claimedToday])


  const close = useCallback(() => {
    setOpen(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !claiming) close()
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (target instanceof Node && !sheetRef.current?.contains(target) && !claiming) close()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [open, close, claiming])

  const claim = useCallback(async () => {
    if (claimInFlightRef.current || claiming || !canAttemptClaim) return
    claimInFlightRef.current = true
    setClaiming(true)
    setError(null)
    try {
      const res = await postDailyClaim()
      if (!res.ok) {
        setError(res.error || "Claim failed. Your reward remains available to retry.")
        return
      }

      if (userId) {
        try {
          markDailyClaimedForUi(userId)
        } catch {
          /* server authoritative */
        }
      }

      const amountLabel = formatAmount(res.serverAmount)
      setDone({
        amount: res.serverAmount,
        redeemableAt: res.redeemableAt,
        pending: res.pending !== false,
        alreadyClaimed: Boolean(res.alreadyClaimed),
      })

      try {
        const { syncWalletAfterServerClaim } = await import(
          "@/lib/domains/adapters/wallet-sync-after-claim"
        )
        await syncWalletAfterServerClaim({
          userId,
          claimedAmount: null,
          alreadyClaimed: Boolean(res.alreadyClaimed),
        })
      } catch {
        /* non-fatal */
      }

      // Local mirror is only created for a newly completed claim with a valid
      // authoritative amount. Durable server notification is the source of truth.
      if (!res.alreadyClaimed && typeof res.serverAmount === "number" && Number.isFinite(res.serverAmount) && res.serverAmount > 0) {
        try {
          notifyRewardClaimed({
            title: "Daily GHC claimed",
            message: `${amountLabel} · pending for 48 hours`,
            amountLabel: String(res.serverAmount),
          })
        } catch {
          /* */
        }
      }
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: { message: `Daily rewards claimed — ${amountLabel}`, type: "success" },
          }),
        )
      } catch {
        /* */
      }
      try {
        window.dispatchEvent(new CustomEvent("ghc:daily-reward-claimed", { detail: res }))
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "daily-claim" } }))
        window.dispatchEvent(new CustomEvent("ghc:wallet-synced", { detail: { reason: "daily-claim" } }))
      } catch {
        /* */
      }
      await refresh?.()
    } catch {
      setError("Could not claim. Try again when online.")
    } finally {
      claimInFlightRef.current = false
      setClaiming(false)
    }
  }, [canAttemptClaim, claiming, refresh, userId])

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setDone(claimedToday ? { pending: true, alreadyClaimed: true } : null)
      setError(null)
      setHint(false)
    }
    window.addEventListener("ghc:open-daily-claim", onOpen)
    return () => window.removeEventListener("ghc:open-daily-claim", onOpen)
  }, [claimedToday])

  // Visible until claimed — do not hide solely because status is still loading.
  
  useEffect(() => {
    if (isLocked) {
      setOpen(false)
      setHint(false)
    }
  }, [isLocked])

  const showFab = Boolean(userId) && !claimedToday && !open && !done && !isLocked

  if (!mounted || typeof document === "undefined") return null

  const ui = (
    <>
      {showFab ? (
        <div
          className="gh-daily-claim-root pointer-events-none fixed z-[150] flex flex-col items-end gap-2"
          style={{
            right: "max(0.75rem, env(safe-area-inset-right))",
            bottom: "calc(var(--gh-bottom-nav-height, 4.5rem) + env(safe-area-inset-bottom) + 1rem)",
          }}
          data-testid="gh-daily-claim-fab-root"
        >
          {hint ? (
            <div
              className="pointer-events-auto max-w-[12rem] rounded-2xl border border-amber-400/50 bg-card/95 px-3 py-2 text-right shadow-lg backdrop-blur-md"
              role="status"
            >
              <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Tap to claim GHC</p>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Daily reward is ready — same idea as Pi’s daily check-in.
              </p>
            </div>
          ) : null}
          <button
            type="button"
            className="gh-daily-lightning-fab pointer-events-auto"
            aria-label="Claim daily GHC reward"
            onClick={() => {
              setHint(false)
              setOpen(true)
              setDone(null)
              setError(null)
            }}
          >
            <span className="gh-daily-lightning-fab-aura" aria-hidden />
            <Zap size={14} fill="currentColor" className="gh-daily-lightning-fab-bolt gh-daily-lightning-fab-bolt-1" aria-hidden />
            <Zap size={12} fill="currentColor" className="gh-daily-lightning-fab-bolt gh-daily-lightning-fab-bolt-2" aria-hidden />
            <span className="gh-daily-lightning-fab-coin">
              <GhcCoinIcon size={34} title="GreenHaven Coin" />
            </span>
            <span className="gh-daily-lightning-fab-dot" aria-hidden />
          </button>
        </div>
      ) : null}

      {open && !isLocked ? (
        <>
          <button
            type="button"
            className="gh-daily-backdrop fixed inset-0 z-[149] bg-slate-950/55 backdrop-blur-sm"
            aria-label="Close daily reward"
            onClick={() => { if (!claiming) close() }}
          />
          <section
            ref={(node) => { sheetRef.current = node }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gh-daily-claim-title"
            className="gh-daily-premium-dialog pointer-events-auto fixed z-[151] text-foreground"
            style={{
              right: "max(0.75rem, env(safe-area-inset-right))",
              bottom: "calc(var(--gh-bottom-nav-height, 4.5rem) + env(safe-area-inset-bottom) + 0.75rem)",
              left: "max(0.75rem, env(safe-area-inset-left))",
              maxHeight: "min(82dvh, 44rem)",
            }}
          >
            <div className="gh-daily-premium-shell">
              <header className="gh-daily-premium-header">
                <div className="min-w-0">
                  <span className="gh-daily-eyebrow"><span className="gh-daily-live-dot" /> GREENHAVEN DAILY REWARDS</span>
                  <h2 id="gh-daily-claim-title" className="mt-1 text-lg font-black tracking-tight text-white">
                    {done ? "Your reward is secured" : "A new day. A new reward."}
                  </h2>
                  <p className="mt-1 max-w-[19rem] text-[11px] leading-relaxed text-emerald-50/75">
                    {done ? "Your claim has been recorded on the GreenHaven ledger." : "Show up, keep your streak alive and collect your daily GHC reward."}
                  </p>
                </div>
                <button type="button" onClick={close} disabled={claiming} className="gh-daily-premium-close" aria-label="Close daily reward">
                  <X size={18} />
                </button>
              </header>

              <div className="gh-daily-premium-body">
                {!done ? (
                  <>
                    <div className="gh-daily-reward-hero">
                      <div className="gh-daily-coin-stage" aria-label="Official GreenHaven Coin logo">
                        <span className="gh-daily-coin-orbit gh-daily-coin-orbit-one" aria-hidden />
                        <span className="gh-daily-coin-orbit gh-daily-coin-orbit-two" aria-hidden />
                        <span className="gh-daily-coin-disc"><GhcCoinIcon size={78} className="gh-daily-official-coin" /></span>
                        <span className="gh-daily-day-chip">DAY {cycleDay ?? "—"} / 7</span>
                      </div>
                      <div className="mt-2 text-center">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Today's reward preview</p>
                        <p className="mt-1 flex items-center justify-center gap-2 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                          {previewAmount != null ? previewAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                          <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">GHC</span>
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Final credited amount is confirmed by the server.</p>
                      </div>
                    </div>

                    <div className="gh-daily-streak-panel">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-extrabold text-foreground">Your 7-day reward journey</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">One check-in per Africa/Lagos day</p>
                        </div>
                        <span className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">{cycleDay ? `Day ${cycleDay} of 7` : "Daily streak"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Seven day claim progress">
                        {Array.from({ length: 7 }, (_, index) => {
                          const day = index + 1
                          const active = cycleDay != null && day < cycleDay
                          const current = cycleDay === day
                          return <div key={day} className={`gh-daily-day-step ${active ? "is-complete" : current ? "is-current" : ""}`} aria-label={`Day ${day}${active ? " completed" : current ? " current" : " upcoming"}`}><span>{active ? "✓" : day}</span></div>
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9px] font-semibold text-muted-foreground"><span>Consistency builds your streak</span><span>Next reset: 00:00 Lagos</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="gh-daily-info-tile"><Shield size={15} /><span><strong>Ledger-backed</strong><small>Server verified</small></span></div>
                      <div className="gh-daily-info-tile"><Clock size={15} /><span><strong>48-hour hold</strong><small>Matures before use</small></span></div>
                    </div>
                    {error ? <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[12px] font-medium text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
                    <button type="button" disabled={claiming || !canAttemptClaim} onClick={() => void claim()} className="gh-daily-premium-cta">
                      {claiming ? <><span className="gh-daily-premium-spinner" /> Securing your reward…</> : <><GhcCoinIcon size={25} className="gh-daily-cta-coin" /> Claim today's GHC <span aria-hidden>→</span></>}
                    </button>
                    <p className="text-center text-[9px] leading-relaxed text-muted-foreground">Daily GHC utility reward · separate from Pi Network cashback and Pi payments.</p>
                  </>
                ) : (
                  <div className="py-3 text-center">
                    <div className="gh-daily-success-coin"><GhcCoinIcon size={82} /></div>
                    <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Claim confirmed</p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{done.alreadyClaimed ? "Already claimed" : formatAmount(done.amount)}</p>
                    <p className="mx-auto mt-2 max-w-xs text-[12px] leading-relaxed text-muted-foreground">{done.pending ? "Your reward is safely recorded as pending and is not spendable until the maturity check completes." : "Your reward has been added to your available GHC balance."}</p>
                    {done.pending ? <div className="gh-daily-maturity-card"><Clock size={17} /><span><strong>48-hour maturity window</strong><small>{done.redeemableAt ? `Expected availability: ${formatRedeemable(done.redeemableAt)}` : "Your Wallet will update when the ledger confirms maturity."}</small></span></div> : null}
                    <button type="button" onClick={close} className="gh-daily-premium-cta mt-5">Continue to GreenHaven <span aria-hidden>→</span></button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}

    </>
  )

  return createPortal(ui, document.body)
}
