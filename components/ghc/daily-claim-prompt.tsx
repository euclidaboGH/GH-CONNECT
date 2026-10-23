"use client"

/**
 * Global Daily GHC claim control.
 *
 * The trigger is fixed above the bottom navigation and therefore never participates
 * in document layout. It remains available across every GreenHaven surface while
 * the server says today's claim is ready. The detailed claim sheet opens only after
 * the user taps the coin, avoiding the large auto-modal/header-jump behavior.
 */
import { useCallback, useEffect, useState } from "react"
import { Check, Clock3, Sparkles, X } from "lucide-react"
import { useDailyClaimStatus } from "./use-daily-claim-status"
import { useGHCProfile } from "@/contexts/ghc-context"
import { notifyRewardClaimed } from "@/lib/notifications"
import { postDailyClaim } from "@/lib/rewards/claim-daily-client"
import { markDailyClaimedForUi } from "@/lib/domains/reward-level-domain"
import { GhcCoinIcon } from "./ghc-coin-icon"

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

export function DailyClaimPrompt() {
  const { profile } = useGHCProfile()
  const userId = profile?.id || ""
  const { status, refresh } = useDailyClaimStatus(userId)
  const [open, setOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState<DoneState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const claimable = Boolean(userId && status?.claimable)
  const claimedToday = Boolean(status?.claimedToday)

  useEffect(() => {
    if (claimable) setDone(null)
  }, [claimable, status?.dayKey])

  const close = useCallback(() => {
    setOpen(false)
    setError(null)
  }, [])

  const claim = useCallback(async () => {
    if (claiming || !claimable) return
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
          /* server remains authoritative */
        }
      }

      const amountLabel = formatAmount(res.serverAmount)
      setDone({
        amount: res.serverAmount,
        redeemableAt: res.redeemableAt,
        pending: res.pending !== false,
        alreadyClaimed: Boolean(res.alreadyClaimed),
      })

      if (!res.alreadyClaimed) reportDailyClaimSuccess(amountLabel)
      try {
        window.dispatchEvent(new CustomEvent("ghc:daily-reward-claimed", { detail: res }))
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
      } catch {
        /* */
      }
      await refresh?.()
    } catch {
      setError("Could not claim. Try again when online.")
    } finally {
      setClaiming(false)
    }
  }, [claimable, claiming, refresh, userId])

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setDone(null)
      setError(null)
    }
    const onRewardSheetVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      if (detail?.open) setOpen(false)
    }
    window.addEventListener("ghc:open-daily-claim", onOpen)
    window.addEventListener("ghc:daily-reward-sheet-visibility", onRewardSheetVisibility)
    return () => {
      window.removeEventListener("ghc:open-daily-claim", onOpen)
      window.removeEventListener("ghc:daily-reward-sheet-visibility", onRewardSheetVisibility)
    }
  }, [])

  // The control itself is intentionally rendered outside normal layout flow.
  const showTrigger = Boolean(userId && (claimable || claimedToday))

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={claimable ? "Daily GHC reward ready to claim" : "Open daily GHC reward status"}
          title={claimable ? "Daily GHC reward ready" : "Today's GHC reward is already claimed"}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-[max(1rem,calc((100vw-var(--gh-content-max,28rem))/2+1rem))] z-[72] flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/80 bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-[0_10px_30px_rgba(120,75,10,0.32)] ring-2 ring-white/80 transition-transform hover:scale-105 active:scale-95 dark:border-amber-300/40 dark:ring-black/40"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/10 shadow-inner">
            <GhcCoinIcon size={34} alt="GHC coin" title="GreenHaven Coin" />
            {claimable ? (
              <span
                className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-white bg-emerald-500 dark:border-background"
                aria-hidden
              />
            ) : null}
          </span>
          <span className="sr-only">{claimable ? "Claim now" : "Claimed today"}</span>
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-ghc-claim-title"
        >
          <button type="button" aria-label="Close daily reward" className="absolute inset-0 cursor-default" onClick={close} />
          <section className="relative w-full max-w-[20rem] overflow-hidden rounded-[1.6rem] border border-amber-200/70 bg-card shadow-2xl dark:border-amber-900/60">
            <div className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-900 px-4 pb-4 pt-4 text-white">
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X size={17} aria-hidden />
              </button>
              <div className="flex items-center gap-3 pr-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-200/70 bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-lg">
                  <GhcCoinIcon size={36} alt="GHC coin" />
                </div>
                <div className="min-w-0">
                  <p id="daily-ghc-claim-title" className="text-[15px] font-extrabold tracking-tight">
                    {done ? (done.alreadyClaimed ? "Already claimed" : "Claim confirmed") : "Daily GHC"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/85">
                    {done
                      ? done.alreadyClaimed
                        ? "No additional GHC was issued."
                        : "Server-confirmed and safely recorded."
                      : `Day ${status?.cycleDay || 1} of 7 · one claim per reward day`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {done ? (
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
                  <div className="flex items-center justify-center gap-2">
                    {done.alreadyClaimed ? <Check className="h-5 w-5 text-emerald-600" aria-hidden /> : <GhcCoinIcon size={24} />}
                    <span className="text-lg font-extrabold tabular-nums">
                      {done.alreadyClaimed ? "Already claimed" : formatAmount(done.amount)}
                    </span>
                  </div>
                  {done.pending && !done.alreadyClaimed ? (
                    <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                      <Clock3 size={12} aria-hidden /> Pending 48h before becoming available
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/35 px-3 py-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Your reward is ready. Tap once to let the server verify and record today's claim.
                  </p>
                </div>
              )}

              {error ? <p className="text-center text-[11px] font-semibold text-red-600" role="alert">{error}</p> : null}

              {!done ? (
                <button
                  type="button"
                  disabled={claiming || !claimable}
                  onClick={() => void claim()}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 px-4 text-sm font-extrabold text-amber-950 shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-2"
                >
                  <GhcCoinIcon size={22} alt="" />
                  {claiming ? "Confirming…" : claimedToday ? "Already claimed" : "Claim Daily GHC"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    close()
                    window.dispatchEvent(new CustomEvent("ghc:open-wallet"))
                  }}
                  className="min-h-11 w-full rounded-full border border-border bg-muted/40 px-4 text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Open wallet
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

export function reportDailyClaimSuccess(amountLabel: string) {
  try {
    notifyRewardClaimed({ message: `Daily rewards claimed — ${amountLabel}`, amountLabel })
    window.dispatchEvent(
      new CustomEvent("ghc:toast", {
        detail: { message: `Daily rewards claimed — ${amountLabel}`, type: "success" },
      })
    )
  } catch {
    /* */
  }
}
