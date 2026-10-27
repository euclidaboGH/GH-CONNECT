"use client"

/**
 * Pi-style daily GHC claim:
 * - Golden lightning + GHC coin FAB portaled to document.body (never clipped by headers).
 * - Mid-right of the viewport on every screen until claimed.
 * - Opens the claim sheet only after an explicit tap on the lightning/coin action.
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
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState<DoneState | null>(null)
  const [error, setError] = useState<string | null>(null)
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
          alreadyClaimed: Boolean(res.alreadyClaimed),
        })
      } catch {
        /* non-fatal */
      }

      try {
        notifyRewardClaimed({
          title: "Daily GHC claimed",
          message: `Daily reward claimed: ${amountLabel}`,
          amountLabel,
        })
      } catch {
        /* */
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
      setClaiming(false)
    }
  }, [canAttemptClaim, claiming, refresh, userId])



  // Keep the entry-point coin visible; never open the claim UI automatically.
  const showFab = Boolean(userId) && !claimedToday && !open && !done

  if (!mounted || typeof document === "undefined") return null

  const ui = (
    <>
      {showFab ? (
        <div
          className="gh-daily-claim-root pointer-events-none fixed z-[9999] flex flex-col items-end gap-2"
          style={{
            right: "max(0.75rem, env(safe-area-inset-right))",
            top: "42%",
            transform: "translateY(-50%)",
          }}
          data-testid="gh-daily-claim-fab-root"
        >
          <button
            type="button"
            className="gh-daily-lightning-fab pointer-events-auto"
            aria-label="Claim daily GHC reward"
            onClick={() => {
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
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 p-3 sm:items-center"
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
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Shield size={14} className="shrink-0 text-emerald-600" />
                      <span>Ledger-backed claim · not pay-to-win · not convertible to π here</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock size={14} className="shrink-0" />
                      <span>Pending GHC may wait ~48h before it becomes spendable</span>
                    </div>
                  </div>

                  {error ? (
                    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={claiming || !canAttemptClaim}
                    onClick={() => void claim()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3.5 text-sm font-bold text-amber-950 shadow-md transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {claiming ? (
                      <>
                        <span className="gh-daily-button-spinner" aria-hidden />
                        Claiming…
                      </>
                    ) : (
                      <>
                        <GhcCoinIcon size={18} />
                        Claim daily GHC
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                    <GhcCoinIcon size={40} />
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {done.alreadyClaimed ? "Already claimed today" : formatAmount(done.amount)}
                  </p>
                  {done.pending ? (
                    <p className="text-[12px] text-muted-foreground">
                      Held as pending until maturity
                      {done.redeemableAt ? ` · available around ${formatRedeemable(done.redeemableAt)}` : ""}.
                    </p>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">Added to your available GHC balance.</p>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-bold"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )

  return createPortal(ui, document.body)
}
