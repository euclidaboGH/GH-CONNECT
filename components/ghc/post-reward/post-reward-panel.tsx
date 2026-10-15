"use client"

/**
 * Post reward / quality strip — Steem-density toolbar style.
 * GHC amounts only when the server reports a funded pool. Never invents balances.
 */
import { useCallback, useEffect, useState } from "react"
import { ChevronRight, X } from "lucide-react"
import type { ContentRewardPublic } from "@/lib/content-reward/types"

function formatGhc(n: number): string {
  if (!Number.isFinite(n)) return "₲ 0.00"
  return `₲ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PostRewardPanel({
  postId,
  upvoteCount,
  downvoteCount,
  compact = true,
}: {
  postId: string
  upvoteCount: number
  downvoteCount: number
  /** When true, render a single Steem-style money/quality control only */
  compact?: boolean
}) {
  const [reward, setReward] = useState<ContentRewardPublic | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      let headers: Record<string, string> = {}
      try {
        const { IdentityService } = await import("@/lib/identity/identity-service")
        headers = { ...(IdentityService.getAuthHeaders?.() || {}) }
      } catch { /* */ }
      try {
        const r = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/reward`, {
          credentials: "include",
          headers,
          cache: "no-store",
        })
        const data = (await r.json().catch(() => null)) as (ContentRewardPublic & { ok?: boolean }) | null
        if (cancelled) return
        if (data && data.ok === true) setReward(data as ContentRewardPublic)
        else setReward(null)
      } catch {
        if (!cancelled) setReward(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [postId])

  useEffect(() => {
    return load()
  }, [load])

  const up = reward?.upvoteCount ?? upvoteCount
  const down = reward?.downvoteCount ?? downvoteCount
  const showMoney =
    reward?.enabled === true &&
    reward.totalEarned != null &&
    (reward.status === "accruing" ||
      reward.status === "finalized" ||
      reward.status === "distributed")

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold tabular-nums transition hover:bg-muted/60"
        aria-label={showMoney ? "View GHC reward details" : "View vote quality"}
      >
        {showMoney ? (
          <span className="text-emerald-700 dark:text-emerald-400">
            {formatGhc(Number(reward!.totalEarned))}
            <span className="ml-0.5 text-[10px] font-bold opacity-80">▾</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {loading ? "…" : `${up}↑ · ${down}↓`}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Post reward"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] border border-border/50 bg-card p-4 shadow-2xl sm:rounded-[1.25rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {showMoney ? "Post reward" : "Content quality"}
              </h2>
              <button
                type="button"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {showMoney ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-600/20 bg-emerald-50/80 p-4 dark:bg-emerald-950/30">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">
                    Total earned
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                    {formatGhc(Number(reward!.totalEarned))}{" "}
                    <span className="text-sm font-semibold">GHC</span>
                  </p>
                  {reward!.status && (
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{reward!.status}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {reward!.authorShare != null && (
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Author</p>
                      <p className="font-semibold tabular-nums">{formatGhc(Number(reward!.authorShare))}</p>
                    </div>
                  )}
                  {reward!.curatorShare != null && (
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Curation</p>
                      <p className="font-semibold tabular-nums">{formatGhc(Number(reward!.curatorShare))}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {up} upvotes · {down} downvotes
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  <span className="font-semibold tabular-nums">{up}</span> up ·{" "}
                  <span className="font-semibold tabular-nums">{down}</span> down
                </p>
                <p className="text-xs text-muted-foreground">
                  Votes rank content. Rewards appear here only when a GHC pool is funded for this post.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
