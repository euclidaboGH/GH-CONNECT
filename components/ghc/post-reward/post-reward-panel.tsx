"use client"

/**
 * Public content-reward panel — amounts only from server GET /reward.
 * Never computes GHC from local vote counts.
 */
import { useCallback, useEffect, useState } from "react"
import {
  Coins,
  ChevronRight,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Users,
} from "lucide-react"
import type { ContentRewardPublic } from "@/lib/content-reward/public-types"

function formatGhc(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function PostRewardPanel({
  postId,
  upvoteCount,
  downvoteCount,
}: {
  postId: string
  upvoteCount: number
  downvoteCount: number
}) {
  const [reward, setReward] = useState<ContentRewardPublic | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    void fetch(`/api/social/posts/${encodeURIComponent(postId)}/reward`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: ContentRewardPublic & { ok?: boolean }) => {
        if (cancelled) return
        if (data && data.ok === true) setReward(data as ContentRewardPublic)
        else setReward(null)
      })
      .catch(() => {
        if (!cancelled) setReward(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
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
        className="flex w-full items-stretch gap-0 border-t border-border/40 bg-card px-3 py-2.5 text-left transition hover:bg-muted/30 dark:hover:bg-muted/20"
        aria-label={showMoney ? "View post reward details" : "View community quality details"}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${
              showMoney
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/40"
                : "bg-muted text-muted-foreground ring-border/50"
            }`}
          >
            <Coins size={20} strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            {showMoney ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Total earned
                </p>
                <p className="truncate text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {formatGhc(reward.totalEarned)}{" "}
                  <span className="text-sm font-semibold text-emerald-700/80">GHC</span>
                  {reward.status === "accruing" && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                      Accruing
                    </span>
                  )}
                  {reward.status === "finalized" && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                      Finalized
                    </span>
                  )}
                  {reward.status === "distributed" && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                      Distributed
                    </span>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600/90 dark:text-violet-300">
                  Community quality
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {loading ? "Loading…" : "Votes rank content · rewards when pool is funded"}
                </p>
              </>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {up} upvotes · {down} downvotes
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center text-muted-foreground">
          <ChevronRight size={18} aria-hidden />
        </div>
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
              <h2 className="text-base font-bold text-foreground">Post reward</h2>
              <button
                type="button"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {showMoney ? (
              <div className="space-y-3">
                <div className="rounded-[1.25rem] border border-border/50 bg-card p-4 shadow-[var(--gh-card-shadow)]">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Total earned
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-300">
                    {formatGhc(reward!.totalEarned)}{" "}
                    <span className="text-lg font-semibold text-muted-foreground">GHC</span>
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700/80 dark:text-emerald-400/80">
                    Status · {reward!.statusLabel}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Author reward
                    </p>
                    <p className="text-base font-bold tabular-nums">
                      {formatGhc(reward!.authorReward)} GHC
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Curation rewards
                    </p>
                    <p className="text-base font-bold tabular-nums">
                      {formatGhc(reward!.curationReward)} GHC
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/60 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <ArrowUpRight size={14} /> Upvote impact
                    </span>
                    <span className="font-semibold tabular-nums text-emerald-700">
                      {reward!.upvoteImpact != null && reward!.upvoteImpact > 0 ? "+" : ""}
                      {formatGhc(reward!.upvoteImpact)} GHC
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-rose-600">
                      <ArrowDownRight size={14} /> Downvote impact
                    </span>
                    <span className="font-semibold tabular-nums text-rose-600">
                      {formatGhc(reward!.downvoteImpact)} GHC
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-1.5 font-bold">
                    <span>Net impact</span>
                    <span className="tabular-nums">
                      {reward!.netImpact != null && reward!.netImpact > 0 ? "+" : ""}
                      {formatGhc(reward!.netImpact)} GHC
                    </span>
                  </div>
                </div>

                {reward!.topContributors.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <Users size={14} /> Top contributors
                    </p>
                    <ul className="space-y-1.5">
                      {reward!.topContributors.map((c) => (
                        <li
                          key={c.username}
                          className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5 text-sm"
                        >
                          <span className="font-medium">@{c.username}</span>
                          <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                            {c.amount != null ? `+${formatGhc(c.amount)} GHC` : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {reward?.note ||
                    "GreenHaven content rewards are allocated from a platform-funded pool by the server. Upvotes and downvotes are quality signals; they do not mint GHC by themselves."}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30">
                    <p className="text-[10px] font-bold uppercase text-emerald-700/80">Upvotes</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                      {up}
                    </p>
                  </div>
                  <div className="rounded-xl bg-rose-50 px-3 py-2.5 dark:bg-rose-950/30">
                    <p className="text-[10px] font-bold uppercase text-rose-600/80">Downvotes</p>
                    <p className="text-xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                      {down}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Status · {reward?.statusLabel || "INACTIVE"} · Downvoters do not earn GHC for
                  downvoting.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
