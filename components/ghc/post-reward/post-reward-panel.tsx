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
        className="block w-full border-t border-violet-200/70 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 px-3 py-3 text-left transition hover:brightness-[0.99] dark:border-violet-900/40 dark:from-violet-950/30 dark:via-card dark:to-fuchsia-950/20 sm:px-4"
        aria-label={showMoney ? "View post reward details" : "View community quality details"}
      >
        {showMoney ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-[190px]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-sm">
                  <Coins size={25} strokeWidth={2.2} aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-violet-800 dark:text-violet-200">Total earned</p>
                  <p className="whitespace-nowrap text-2xl font-extrabold leading-tight tracking-tight text-violet-950 dark:text-white">
                    {formatGhc(reward.totalEarned)} <span className="text-sm font-bold">GHC</span>
                  </p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${reward.status === "accruing" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" : "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"}`}>
                    {reward.status === "accruing" ? "↗ Accruing" : reward.statusLabel}
                  </span>
                </div>
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 border-t border-violet-200/70 pt-3 dark:border-violet-900/50 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Author reward</p>
                  <p className="text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{formatGhc(reward.authorReward)} GHC</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">70%</p>
                </div>
                <div className="min-w-0 border-l border-violet-200/70 pl-3 dark:border-violet-900/50">
                  <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Curation rewards</p>
                  <p className="text-lg font-extrabold tabular-nums text-violet-700 dark:text-violet-300">{formatGhc(reward.curationReward)} GHC</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">30%</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-fuchsia-300 bg-fuchsia-100/80 px-3 py-2 text-xs font-bold text-violet-900 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-100">View details <ChevronRight size={16} /></span>
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-violet-200/80 rounded-2xl bg-white/70 px-1 py-2 dark:divide-violet-900/60 dark:bg-black/10">
              <div className="flex items-center justify-center gap-2 px-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><ArrowUpRight size={21} /></span>
                <span className="min-w-0"><span className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Upvotes</span><span className="block text-xs font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{up} · {reward.upvoteImpact != null ? `+${formatGhc(reward.upvoteImpact)}` : "—"} GHC</span></span>
              </div>
              <div className="flex items-center justify-center gap-2 px-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300"><ArrowDownRight size={21} /></span>
                <span className="min-w-0"><span className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Downvotes</span><span className="block text-xs font-extrabold tabular-nums text-pink-600 dark:text-pink-300">{down} · {formatGhc(reward.downvoteImpact)} GHC</span></span>
              </div>
              <div className="flex items-center justify-center gap-2 px-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"><Users size={20} /></span>
                <span className="min-w-0"><span className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Net impact</span><span className="block text-xs font-extrabold tabular-nums text-violet-800 dark:text-violet-200">{reward.netImpact != null && reward.netImpact > 0 ? "+" : ""}{formatGhc(reward.netImpact)} GHC</span></span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3 dark:from-violet-950/30 dark:to-fuchsia-950/20">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"><Coins size={22} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-violet-700 dark:text-violet-300">Community quality</p>
              <p className="text-sm font-semibold text-foreground">{loading ? "Loading reward details…" : "Votes rank content · rewards when the pool is funded"}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{up} upvotes · {down} downvotes</p>
            </div>
            <ChevronRight size={20} className="shrink-0 text-violet-700" />
          </div>
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
