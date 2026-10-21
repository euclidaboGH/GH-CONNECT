"use client"

/**
 * Pi-mining-style daily claim modal — floats over Home without pushing the header.
 * Claims via server-authoritative /api/economy/rewards/daily only.
 */
import { useCallback, useEffect, useState } from "react"
import { Gift, X, Sparkles, Check } from "lucide-react"
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
}

export function DailyClaimPrompt() {
  const { profile } = useGHCProfile()
  const userId = profile?.id || ""
  const { status, refresh } = useDailyClaimStatus(userId)
  const [dismissedDay, setDismissedDay] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState<DoneState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dayKey = status?.dayKey || ""
  const claimable = Boolean(status?.claimable)
  const claimedToday = Boolean(status?.claimedToday)

  useEffect(() => {
    try {
      const d = window.localStorage.getItem("ghc-daily-claim-dismissed-day")
      if (d) setDismissedDay(d)
    } catch {
      /* */
    }
  }, [])

  useEffect(() => {
    if (claimable) setDone(null)
  }, [claimable, dayKey])

  const dismiss = useCallback(() => {
    if (dayKey) {
      try {
        window.localStorage.setItem("ghc-daily-claim-dismissed-day", dayKey)
      } catch {
        /* */
      }
      setDismissedDay(dayKey)
    }
    setDone(null)
    setError(null)
  }, [dayKey])

  const claim = useCallback(async () => {
    if (claiming) return
    setClaiming(true)
    setError(null)
    try {
      const res = await postDailyClaim()
      if (!res.ok) {
        setError(res.error || "Claim failed")
        return
      }
      if (userId) {
        try {
          markDailyClaimedForUi(userId)
        } catch {
          /* */
        }
      }
      const amt = res.serverAmount
      const amountLabel =
        typeof amt === "number" && Number.isFinite(amt)
          ? `₲ ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "Daily GHC"
      setDone({
        amount: amt,
        redeemableAt: res.redeemableAt,
        pending: res.pending !== false,
      })
      reportDailyClaimSuccess(amountLabel)
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
  }, [claiming, userId, refresh])

  useEffect(() => {
    const onOpen = () => {
      try {
        window.localStorage.removeItem("ghc-daily-claim-dismissed-day")
      } catch {
        /* */
      }
      setDismissedDay(null)
    }
    window.addEventListener("ghc:open-daily-claim", onOpen)
    return () => window.removeEventListener("ghc:open-daily-claim", onOpen)
  }, [])

  const visible =
    Boolean(userId) && (done || (claimable && (!dayKey || dismissedDay !== dayKey)))

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Daily GHC claim"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-200/40 bg-card shadow-2xl dark:border-emerald-900/50">
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/5 p-1.5 text-muted-foreground hover:bg-black/10 dark:bg-white/10"
        >
          <X size={18} />
        </button>

        <div className="bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-800 px-6 pb-8 pt-10 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
            {done ? <Check size={32} aria-hidden /> : <Gift size={32} aria-hidden />}
          </div>
          <p className="text-lg font-bold tracking-tight">
            {done ? "Claim recorded" : "Daily mining ready"}
          </p>
          <p className="mt-1 text-[12px] text-emerald-50/95">
            {done
              ? done.pending
                ? "GHC is pending for 48 hours, then moves to your available wallet balance."
                : "Check your GHC wallet for the updated balance."
              : "Claim today’s GreenHaven Coin — server verified, one claim per Lagos day."}
          </p>
        </div>

        <div className="space-y-3 px-5 py-5">
          {done ? (
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 text-center dark:border-emerald-900/40 dark:bg-emerald-950/40">
              <div className="flex items-center justify-center gap-2">
                <GhcCoinIcon size={28} />
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                  {typeof done.amount === "number" && Number.isFinite(done.amount)
                    ? `₲ ${done.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "Claimed"}
                </p>
              </div>
              {done.redeemableAt ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Available after {new Date(done.redeemableAt).toLocaleString()}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pending 48h · then claim into Available in Wallet
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-3 py-3">
              <Sparkles className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <p className="text-[12px] leading-snug text-muted-foreground">
                Same idea as Pi mining: claim when ready. Balance only changes after the server
                confirms.
              </p>
            </div>
          )}

          {error ? (
            <p className="text-center text-[12px] font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {!done ? (
            <button
              type="button"
              disabled={claiming || claimedToday}
              onClick={() => void claim()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gh-green)] text-[15px] font-bold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {claiming ? "Claiming…" : claimedToday ? "Already claimed" : "Claim daily GHC"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                dismiss()
                try {
                  window.dispatchEvent(new CustomEvent("ghc:open-wallet"))
                } catch {
                  /* */
                }
              }}
              className="flex min-h-12 w-full items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[14px] font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
            >
              Open wallet
            </button>
          )}

          {!done ? (
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-2 text-center text-[12px] font-medium text-muted-foreground"
            >
              Later
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function reportDailyClaimSuccess(amountLabel: string) {
  try {
    notifyRewardClaimed({ message: `Daily rewards claimed — ${amountLabel}`, amountLabel })
    window.dispatchEvent(
      new CustomEvent("ghc:toast", {
        detail: {
          message: `Daily rewards claimed — ${amountLabel}`,
          type: "success",
        },
      })
    )
  } catch {
    /* */
  }
}
