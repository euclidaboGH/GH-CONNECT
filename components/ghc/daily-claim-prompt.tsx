"use client"

/**
 * Daily GHC claim — production golden lightning FAB on every screen.
 * Does not use the GHC coin logo on the FAB. Does not push page headers.
 * Sheet confirms claim; server postDailyClaim is authoritative.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { X, Zap, Shield, Clock } from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { useGHCProfile } from "@/contexts/ghc-context"
import { useDailyClaimStatus } from "./use-daily-claim-status"
import { notifyRewardClaimed } from "@/lib/notifications"
import { postDailyClaim } from "@/lib/rewards/claim-daily-client"
import { markDailyClaimedForUi, ghcForCycleDay } from "@/lib/domains/reward-level-domain"

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
  const userId = profile?.id || ""
  const { status, refresh } = useDailyClaimStatus(userId)
  useEffect(() => {
    if (userId) void refresh()
  }, [userId, refresh])
  const [open, setOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState<DoneState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState(false)
  const sheetRef = useRef<HTMLElement | null>(null)

  const claimedToday = Boolean(status?.claimedToday)
  // Status null = still loading / offline — keep FAB visible so users never lose the claim entry point.
  const canAttemptClaim = Boolean(userId && !claimedToday && (status === null || status.claimable !== false))
  const claimable = Boolean(userId && !claimedToday && (status === null || status.claimable !== false))
  const cycleDay =
    typeof status?.cycleDay === "number" && status.cycleDay > 0 ? status.cycleDay : null
  const tier =
    (profile as { membershipTier?: string; tier?: string } | null)?.membershipTier ||
    (profile as { tier?: string } | null)?.tier
  const previewAmount = cycleDay != null ? ghcForCycleDay(cycleDay, tier) : undefined

  useEffect(() => {
    if (claimable) setDone(null)
  }, [claimable, status?.dayKey])

  useEffect(() => {
    if (!claimable || claimedToday) return
    try {
      if (sessionStorage.getItem("ghc.dailyClaimHintShown") === "1") return
      sessionStorage.setItem("ghc.dailyClaimHintShown", "1")
      setHint(true)
      const t = window.setTimeout(() => setHint(false), 8000)
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
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, close, claiming])

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
          alreadyClaimed: Boolean(res.alreadyClaimed || res.idempotent),
          referenceId: res.referenceId ?? null,
        })
      } catch {
        /* keep last verified wallet snapshot */
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
      setHint(false)
    }
    window.addEventListener("ghc:open-daily-claim", onOpen)
    return () => window.removeEventListener("ghc:open-daily-claim", onOpen)
  }, [])

  // Golden coin+lightning on every screen until claimed (mid-right of content, never in header)
  const showFab = Boolean(userId) && !claimedToday && !open && !done

  return (
    <>
      {showFab ? (
        <div
          className="pointer-events-none fixed z-[150] flex flex-col items-end gap-2"
          style={{
            right: "max(0.65rem, env(safe-area-inset-right))",
            top: "max(28%, calc(env(safe-area-inset-top, 0px) + 7.5rem))",
            transform: "translateY(-20%)",
          }}
        >
          {hint ? (
            <div
              className="pointer-events-auto max-w-[11.5rem] rounded-2xl border border-amber-400/50 bg-card/95 px-3 py-2 text-right shadow-lg backdrop-blur-md"
              role="status"
            >
              <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Tap the lightning!</p>
              <p className="text-[10px] leading-snug text-muted-foreground">Daily GHC is ready to claim.</p>
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

      {open ? (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !claiming) close()
          }}
        >
          <section
            ref={(node) => {
              sheetRef.current = node
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gh-daily-claim-title"
            className="gh-daily-claim-popover w-full max-w-md overflow-hidden rounded-[1.35rem] border border-amber-500/25 bg-card text-foreground shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
              <div className="min-w-0">
                <h2 id="gh-daily-claim-title" className="text-base font-bold tracking-tight">
                  {done ? "You claimed today’s GHC" : "Claim today’s GHC"}
                </h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {done
                    ? "Recorded on the durable ledger. Pending balance follows the maturity schedule."
                    : "One claim per Lagos day. The server sets the amount — nothing is minted in the browser."}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={claiming}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <div className="space-y-3 px-4 py-4">
              {!done ? (
                <>
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-3">
                    <div className="gh-daily-lightning-fab h-12 w-12 shrink-0 !shadow-md" aria-hidden>
                      <Zap size={11} fill="currentColor" className="gh-daily-lightning-fab-bolt gh-daily-lightning-fab-bolt-1" />
                      <span className="gh-daily-lightning-fab-coin">
                        <GhcCoinIcon size={28} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {previewAmount != null ? formatAmount(previewAmount) : "Daily GHC reward"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {cycleDay ? `Cycle day ${cycleDay} of 7` : "Daily cycle"} · Preview — server finalizes amount
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                        <Shield size={13} className="text-emerald-600" aria-hidden />
                        Governed daily path
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        Active
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      Claiming registers today’s reward on the durable ledger. Social actions do not mint extra GHC beyond this path.
                    </p>
                  </div>

                  {error ? (
                    <p
                      className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      <Zap size={28} fill="currentColor" />
                    </div>
                    <p className="text-lg font-bold text-amber-800 dark:text-amber-200">
                      {done.alreadyClaimed ? "Already claimed today" : formatAmount(done.amount)}
                    </p>
                    {done.pending ? (
                      <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock size={12} aria-hidden />
                        Pending until maturity
                        {formatRedeemable(done.redeemableAt)
                          ? ` · available ${formatRedeemable(done.redeemableAt)}`
                          : ""}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Credited on the durable wallet ledger.</p>
                    )}
                  </div>
                  <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                    Wallet shows pending holds · Rewards centre shows streak and missions.
                  </p>
                </div>
              )}
            </div>

            <footer className="grid gap-2 border-t border-border p-3">
              {!done ? (
                <button
                  type="button"
                  disabled={claiming || !canAttemptClaim}
                  onClick={() => void claim()}
                  className="flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 text-[15px] font-bold text-amber-950 shadow-md active:scale-[0.98] hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
                >
                  {claiming ? (
                    <span className="gh-daily-button-spinner" aria-hidden />
                  ) : (
                    <Zap size={16} fill="currentColor" aria-hidden />
                  )}
                  {claiming ? "Claiming…" : "Claim GHC"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={close}
                  className="flex min-h-11 items-center justify-center rounded-2xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
                >
                  Done
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  close()
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:open-rewards"))
                    window.dispatchEvent(
                      new CustomEvent("ghc:open-settings-section", { detail: { section: "rewards" } }),
                    )
                  } catch {
                    /* */
                  }
                }}
                className="min-h-10 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:underline"
              >
                Open Rewards details
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  )
}
