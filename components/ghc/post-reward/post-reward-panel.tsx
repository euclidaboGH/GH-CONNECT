"use client"

/**
 * Public content-reward panel — amounts only from server GET /reward.
 * Never computes GHC from local vote counts.
 */
import { useCallback, useEffect, useState } from "react"
import { Coins, ChevronRight, X, ArrowUpRight, ArrowDownRight, Users, Database } from "lucide-react"
import type { ContentRewardPublic } from "@/lib/content-reward/public-types"
import { CONTENT_REWARD_AUTHOR_SHARE, CONTENT_REWARD_CURATION_SHARE } from "@/lib/content-reward/public-types"

function formatGhc(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusBadge(status: string) {
  if (status === "accruing")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
        Accruing
      </span>
    )
  if (status === "finalized")
    return (
      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
        Finalized
      </span>
    )
  if (status === "distributed")
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
        Paid
      </span>
    )
  return null
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
    void (async () => {
      let headers: Record<string, string> = {}
      try {
        const { IdentityService } = await import("@/lib/identity/identity-service")
        headers = { ...(IdentityService.getAuthHeaders?.() || {}) }
      } catch {
        /* */
      }
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

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") load()
    }
    const onCur = (e: Event) => {
      const id = (e as CustomEvent)?.detail?.postId
      if (id && String(id) === String(postId)) load()
    }
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("ghc:curation-updated", onCur)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("ghc:curation-updated", onCur)
    }
  }, [load, postId])

  const up = reward?.upvoteCount ?? upvoteCount
  const down = reward?.downvoteCount ?? downvoteCount
  const showMoney =
    reward?.enabled === true &&
    reward.totalEarned != null &&
    (reward.status === "accruing" ||
      reward.status === "finalized" ||
      reward.status === "distributed")

  const total = reward?.totalEarned ?? null
  const author =
    reward?.authorReward ?? (total != null ? total * CONTENT_REWARD_AUTHOR_SHARE : null)
  const curation =
    reward?.curationReward ?? (total != null ? total * CONTENT_REWARD_CURATION_SHARE : null)
  const upImpact = reward?.upvoteImpact
  const downImpact = reward?.downvoteImpact
  const net = reward?.netImpact ?? total

  if (showMoney) {
    return (
      <>
        <div className="border-t border-violet-100/80 bg-gradient-to-b from-violet-50/90 to-white px-3 py-2.5 dark:from-violet-950/40 dark:to-card dark:border-violet-900/40">
          <div className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
              <Database size={18} strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Total earned
                </p>
                {statusBadge(reward!.status)}
              </div>
              <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-violet-800 dark:text-violet-200">
                {formatGhc(total)} <span className="text-sm font-semibold text-violet-600/90">GHC</span>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/80 px-2.5 py-1.5 ring-1 ring-violet-100 dark:bg-card/60 dark:ring-violet-900/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Author reward
                  </p>
                  <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatGhc(author)} GHC
                  </p>
                  <p className="text-[10px] text-muted-foreground">70%</p>
                </div>
                <div className="rounded-xl bg-white/80 px-2.5 py-1.5 ring-1 ring-violet-100 dark:bg-card/60 dark:ring-violet-900/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Curation rewards
                  </p>
                  <p className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {formatGhc(curation)} GHC
                  </p>
                  <p className="text-[10px] text-muted-foreground">30%</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-50 dark:border-violet-800 dark:bg-card dark:text-violet-300"
            >
              View details
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-violet-100/80 pt-2 dark:border-violet-900/40">
            <div className="rounded-xl bg-emerald-50/90 px-2 py-1.5 text-center dark:bg-emerald-950/30">
              <p className="text-[10px] font-semibold text-emerald-700/90">↑ {up} upvotes</p>
              <p className="text-[11px] font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                {upImpact != null ? `+${formatGhc(upImpact)} GHC` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-rose-50/90 px-2 py-1.5 text-center dark:bg-rose-950/30">
              <p className="text-[10px] font-semibold text-rose-600/90">↓ {down} downvotes</p>
              <p className="text-[11px] font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {downImpact != null ? `−${formatGhc(Math.abs(downImpact))} GHC` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-violet-50/90 px-2 py-1.5 text-center dark:bg-violet-950/30">
              <p className="text-[10px] font-semibold text-violet-700/90">Net impact</p>
              <p className="text-[11px] font-bold tabular-nums text-violet-800 dark:text-violet-200">
                {net != null ? `+${formatGhc(net)} GHC` : "—"}
              </p>
            </div>
          </div>
        </div>
        {open && <RewardDetailSheet reward={reward!} up={up} down={down} onClose={() => setOpen(false)} />}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2 border-t border-border/30 bg-muted/15 px-3.5 py-1.5 text-left transition hover:bg-muted/35"
        aria-label="View quality ranking"
      >
        <Coins size={14} strokeWidth={2.25} className="shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">
          {loading ? "Quality…" : "Quality"}
          <span className="ml-1.5 tabular-nums">
            {up}↑ · {down}↓
          </span>
        </p>
        <ChevronRight
          size={14}
          className="shrink-0 text-muted-foreground/70 transition group-hover:text-foreground"
          aria-hidden
        />
      </button>
      {open && (
        <RewardDetailSheet reward={reward} up={up} down={down} onClose={() => setOpen(false)} inactive />
      )}
    </>
  )
}

function RewardDetailSheet({
  reward,
  up,
  down,
  onClose,
  inactive,
}: {
  reward: ContentRewardPublic | null
  up: number
  down: number
  onClose: () => void
  inactive?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Post reward"
      onClick={onClose}
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
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {!inactive && reward?.enabled ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-violet-50 p-3 dark:bg-violet-950/30">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Total earned</p>
              <p className="text-2xl font-bold tabular-nums text-violet-800 dark:text-violet-200">
                {formatGhc(reward.totalEarned)} GHC
              </p>
              <div className="mt-1">{statusBadge(reward.status)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/40 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Author</p>
                <p className="text-lg font-bold tabular-nums text-emerald-700">
                  {formatGhc(reward.authorReward)} GHC
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Curation</p>
                <p className="text-lg font-bold tabular-nums text-violet-700">
                  {formatGhc(reward.curationReward)} GHC
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                <ArrowUpRight size={16} className="text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold">{up} upvotes</p>
                  <p className="text-[11px] tabular-nums text-emerald-700">
                    {reward.upvoteImpact != null ? `+${formatGhc(reward.upvoteImpact)}` : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
                <ArrowDownRight size={16} className="text-rose-600" />
                <div>
                  <p className="text-xs font-semibold">{down} downvotes</p>
                  <p className="text-[11px] tabular-nums text-rose-700">
                    {reward.downvoteImpact != null
                      ? `−${formatGhc(Math.abs(reward.downvoteImpact))}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
            {reward.topContributors && reward.topContributors.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Users size={14} /> Top contributors
                </p>
                <ul className="space-y-1.5">
                  {reward.topContributors.map((c) => (
                    <li
                      key={c.username}
                      className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5 text-sm"
                    >
                      <span className="font-medium">@{c.username}</span>
                      <span className="tabular-nums text-emerald-700">
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
                "Quality votes help ranking. GHC comes from the platform pool when funded — not from voting itself."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30">
                <p className="text-[10px] font-bold uppercase text-emerald-700/80">Upvotes</p>
                <p className="text-xl font-bold tabular-nums text-emerald-800">{up}</p>
              </div>
              <div className="rounded-xl bg-rose-50 px-3 py-2.5 dark:bg-rose-950/30">
                <p className="text-[10px] font-bold uppercase text-rose-600/80">Downvotes</p>
                <p className="text-xl font-bold tabular-nums text-rose-700">{down}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Status · {reward?.statusLabel || "Inactive"}</p>
          </div>
        )}
      </div>
    </div>
  )
}
