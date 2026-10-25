"use client"

/**
 * Daily GHC claim — Pi/Rubi-style floating action (does NOT push page headers).
 * Details live under Settings → Rewards. Appears only when claimable; vanishes after claim.
 */
import { useCallback, useEffect, useState } from "react"
import { Clock3, Sparkles, X, Zap } from "lucide-react"
import { useGHCProfile } from "@/contexts/ghc-context"
import { useDailyClaimStatus } from "./use-daily-claim-status"
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
    if (claimable) {
      setDone(null)
    }
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

      try {
        const { syncWalletAfterServerClaim } = await import(
          "@/lib/domains/adapters/wallet-sync-after-claim"
        )
        await syncWalletAfterServerClaim({
          userId,
          claimedAmount: null,
          alreadyClaimed: Boolean(res.alreadyClaimed || res.idempotent),
          referenceId: res.referenceId ?? null,
        })
      } catch {
        // The claim is confirmed, but the client keeps its last verified wallet snapshot.
      }

      if (!res.alreadyClaimed) {
        try {
          notifyRewardClaimed({ message: `Daily rewards claimed — ${amountLabel}`, amountLabel })
          window.dispatchEvent(
            new CustomEvent("ghc:toast", {
              detail: { message: `Daily rewards claimed — ${amountLabel}`, type: "success" },
            }),
          )
        } catch {
          /* */
        }
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
      setClaiming(false)
    }
  }, [claimable, claiming, refresh, userId])

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setDone(null)
      setError(null)
    }
    window.addEventListener("ghc:open-daily-claim", onOpen)
    return () => window.removeEventListener("ghc:open-daily-claim", onOpen)
  }, [])

  // Show FAB only when claimable and not dismissed for this session day
  const showFab = claimable && !claimedToday && !open

  return (
    <>
      {showFab ? (
        <div
          className="pointer-events-none fixed z-[70] flex flex-col items-end gap-2"
          style={{
            right: "max(0.75rem, env(safe-area-inset-right))",
            bottom: "calc(4.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-amber-950 shadow-lg shadow-amber-700/30 ring-2 ring-white/80 transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/60 motion-reduce:transition-none dark:ring-black/40"
            aria-label="Claim daily GHC reward"
            onClick={() => {
              setOpen(true)
              setDone(null)
              setError(null)
            }}
          >
            <Zap className="h-7 w-7 fill-amber-950/20" strokeWidth={2.25} aria-hidden />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-background" aria-hidden />
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="daily-claim-title">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-card text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                  <Zap className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 id="daily-claim-title" className="text-[15px] font-extrabold leading-tight">
                    Daily GHC
                  </h2>
                  <p className="text-[11px] text-muted-foreground">Server-verified · Lagos day</p>
                </div>
              </div>
              <button type="button" onClick={close} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {done ? (
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-3 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                  <div className="flex items-center justify-center gap-2">
                    <GhcCoinIcon size={24} />
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
                    Tap once to let the server verify and record today&apos;s claim. Full history is under Rewards in Settings.
                  </p>
                </div>
              )}

              {error ? (
                <p className="text-center text-[11px] font-semibold text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              {!done ? (
                <button
                  type="button"
                  disabled={claiming || !claimable}
                  onClick={() => void claim()}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 px-4 text-sm font-extrabold text-amber-950 shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Zap className="h-5 w-5" aria-hidden />
                  {claiming ? "Confirming…" : "Claim Daily GHC"}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      try {
                        window.dispatchEvent(new CustomEvent("ghc:open-wallet"))
                      } catch {
                        /* */
                      }
                    }}
                    className="min-h-11 flex-1 rounded-full border border-border bg-muted/40 text-sm font-bold"
                  >
                    Open wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      try {
                        window.dispatchEvent(new CustomEvent("ghc:open-rewards"))
                      } catch {
                        /* */
                      }
                    }}
                    className="min-h-11 flex-1 rounded-full bg-[var(--gh-green)] text-sm font-bold text-white"
                  >
                    Rewards
                  </button>
                </div>
              )}
            </div>
          </div>
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
      }),
    )
  } catch {
    /* */
  }
}
