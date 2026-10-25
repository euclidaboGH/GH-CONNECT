"use client"

/**
 * Daily GHC claim — Pi/Rubi-style floating action (does NOT push page headers).
 * Details live under Settings → Rewards. Auto-prompts once per eligible day and keeps a retryable lightning action.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { X, Zap } from "lucide-react"
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
  const popoverRef = useRef<HTMLElement | null>(null)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const claimedToday = Boolean(status?.claimedToday)
  // Status can be temporarily unknown while the server request is loading or
  // the network is recovering. Let the user open/attempt the server-authorized
  // flow instead of rendering a dead, permanently disabled claim button.
  const canAttemptClaim = Boolean(userId && !claimedToday && (status === null || status.claimable))
  const claimable = Boolean(userId && status?.claimable && !claimedToday)

  // The daily claim stays as a compact floating action above the bottom nav.
  // It must not inject a banner into the header or auto-open a blocking sheet.

  useEffect(() => {
    if (claimable) {
      setDone(null)
    }
  }, [claimable, status?.dayKey])

  const clearAutoDismiss = useCallback(() => {
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current)
      autoDismissRef.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearAutoDismiss()
    setOpen(false)
    setError(null)
  }, [clearAutoDismiss])

  // A successful claim notice is transient: outside tap closes it immediately,
  // and it also dismisses itself after 10 seconds if left untouched.
  useEffect(() => {
    if (!open || (!done && !error)) return
    clearAutoDismiss()
    autoDismissRef.current = setTimeout(() => setOpen(false), 10_000)
    return clearAutoDismiss
  }, [open, done, error, clearAutoDismiss])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !popoverRef.current?.contains(target) && !(target instanceof Element && target.closest(".gh-daily-coin-button"))) {
        close()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, close])

  const claim = useCallback(async () => {
    if (claiming || !canAttemptClaim) return
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
  }, [canAttemptClaim, claiming, refresh, userId])

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setDone(null)
      setError(null)
      if (canAttemptClaim) void claim()
    }
    window.addEventListener("ghc:open-daily-claim", onOpen)
    return () => window.removeEventListener("ghc:open-daily-claim", onOpen)
  }, [canAttemptClaim, claim])

  // Keep the lightning action available while status is unknown so server-side errors are recoverable.
  const showFab = canAttemptClaim && !open

  return (
    <>
      {showFab ? (
        <div
          className="pointer-events-none fixed z-[150] flex flex-col items-end"
          style={{
            right: "max(0.8rem, env(safe-area-inset-right))",
            bottom: "calc(var(--gh-bottom-nav-height, 5.35rem) + 0.7rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <button
            type="button"
            className="gh-daily-coin-button pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/60"
            aria-label={open ? "Close daily GHC reward" : "Open daily GHC reward claim"}
            aria-expanded={open}
            aria-controls="daily-claim-popover"
            onClick={() => {
              if (open) {
                close()
                return
              }
              clearAutoDismiss()
              setOpen(true)
              setDone(null)
              setError(null)
              // Tapping the coin itself starts the server-verified claim.
              if (canAttemptClaim) void claim()
            }}
          >
            <span className="gh-daily-coin-aura" aria-hidden="true" />
            <span className="gh-daily-lightning gh-daily-lightning-one" aria-hidden="true"><Zap size={13} fill="currentColor" /></span>
            <span className="gh-daily-lightning gh-daily-lightning-two" aria-hidden="true"><Zap size={10} fill="currentColor" /></span>
            <span className="gh-daily-lightning gh-daily-lightning-three" aria-hidden="true"><Zap size={11} fill="currentColor" /></span>
            <GhcCoinIcon size={42} className="gh-daily-coin-art relative z-[2] drop-shadow-[0_2px_5px_rgba(0,0,0,0.4)]" />
            <span className="absolute -right-0.5 -top-0.5 z-[3] h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {open ? (
        <section
          id="daily-claim-popover"
          ref={(node) => { popoverRef.current = node }}
          className="gh-daily-claim-popover fixed z-[149] w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.35rem] border border-amber-400/35 bg-card/95 text-foreground shadow-[0_18px_55px_rgba(0,0,0,0.28)] backdrop-blur-xl"
          style={{
            right: "max(0.8rem, env(safe-area-inset-right))",
            bottom: "calc(var(--gh-bottom-nav-height, 5.35rem) + 4.95rem + env(safe-area-inset-bottom, 0px))",
          }}
          role="dialog"
          aria-modal="false"
          aria-labelledby="daily-claim-title"
        >
          <div className="flex items-start gap-2.5 border-b border-border/50 px-3.5 pb-3 pt-3.5">
            <span className="gh-daily-popover-coin flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <GhcCoinIcon size={34} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="daily-claim-title" className="text-[14px] font-extrabold leading-tight">Daily GHC reward</h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300">Your daily check-in</p>
            </div>
            <button type="button" onClick={close} disabled={claiming} className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Close daily reward" aria-disabled={claiming}>
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3 px-3.5 py-3.5">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Check in every day to collect your GHC reward and keep your streak going.
            </p>

            {done ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <GhcCoinIcon size={23} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-extrabold">{done.alreadyClaimed ? "Today’s reward is already claimed" : formatAmount(done.amount)}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {done.pending && !done.alreadyClaimed ? "Pending for 48 hours · then available in your wallet" : "Your claim has been checked by GreenHaven"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {status === null && !done ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground">Connecting to the secure rewards service… Your balance is only updated after the server confirms your claim.</p>
            ) : null}

            {error ? <p className="text-[11px] font-semibold text-red-600" role="alert">{error}</p> : null}

            {claiming ? (
              <div className="flex items-center justify-center gap-2 py-1 text-[11px] font-semibold text-muted-foreground" role="status">
                <span className="gh-daily-button-spinner" aria-hidden="true" /> Verifying your daily reward…
              </div>
            ) : null}

            {error ? (
              <button type="button" onClick={() => void claim()} disabled={claiming || !canAttemptClaim} className="min-h-9 w-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-3 text-[11px] font-extrabold text-amber-950 disabled:opacity-60">
                Try claim again
              </button>
            ) : null}
            <p className="text-center text-[9px] text-muted-foreground">Verified by GreenHaven · One claim per day</p>
          </div>
        </section>
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
