"use client"

/**
 * Pi-mining-style daily claim prompt: appears when the server says claimable.
 * Does not invent balances — uses existing useDailyClaimStatus + claim API path via Rewards.
 */
import { useEffect, useState } from "react"
import { Gift, X } from "lucide-react"
import { useDailyClaimStatus } from "./use-daily-claim-status"
import { useGHCShell, useGHCProfile } from "@/contexts/ghc-context"
import { notifyRewardClaimed } from "@/lib/notifications"

export function DailyClaimPrompt() {
  const shell = useGHCShell()
  const { profile } = useGHCProfile()
  const userId = profile?.id || ""
  const { status, refresh } = useDailyClaimStatus(userId)
  const [dismissedDay, setDismissedDay] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

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

  if (!userId || !claimable || (dayKey && dismissedDay === dayKey)) return null

  const dismiss = () => {
    if (dayKey) {
      try {
        window.localStorage.setItem("ghc-daily-claim-dismissed-day", dayKey)
      } catch {
        /* */
      }
      setDismissedDay(dayKey)
    }
  }

  const openRewardsAndClaim = async () => {
    setClaiming(true)
    try {
      shell.setTab?.("rewards" as never)
      // Soft event — rewards centre listens and can auto-focus claim
      window.dispatchEvent(new CustomEvent("ghc:open-daily-claim"))
      await refresh?.()
    } catch {
      /* */
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] z-[55] flex justify-center px-3 sm:bottom-24"
      role="dialog"
      aria-label="Daily GHC claim available"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-700 to-emerald-600 px-3 py-3 text-white shadow-[0_12px_40px_rgba(6,95,70,0.35)]">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Gift size={22} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight">Daily claim is ready</p>
          <p className="text-[11px] text-emerald-50/95">
            {claimedToday
              ? "Already claimed for today"
              : "Open Rewards to claim today’s GHC — server verified"}
          </p>
        </div>
        <button
          type="button"
          disabled={claiming}
          onClick={() => void openRewardsAndClaim()}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-emerald-800 disabled:opacity-60"
        >
          {claiming ? "…" : "Claim"}
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/** Call after a successful server claim to notify the user clearly. */
export function reportDailyClaimSuccess(amountLabel: string) {
  try {
    notifyRewardClaimed({ amountLabel })
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
