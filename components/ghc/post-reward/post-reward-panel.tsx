"use client"

/**
 * Compact post reward control. Amounts only from server.
 */
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { ContentRewardPublic } from "@/lib/content-reward/public-types"

function formatGhc(n: number): string {
  if (!Number.isFinite(n)) return "₲ 0.00"
  return `₲ ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
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

  // A successful wallet-funded curation/tip/creator settlement updates the
  // durable content-reward projection. Refresh an already-open panel immediately
  // instead of waiting for the user to close and reopen it.
  useEffect(() => {
    const onRewardUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ postId?: string }>).detail
      if (!detail?.postId || detail.postId !== postId) return
      setReward((current) => current ? { ...current } : current)
      setLoading(true)
      void fetch(`/api/social/posts/${encodeURIComponent(postId)}/reward`, {
        credentials: "include",
        cache: "no-store",
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as (ContentRewardPublic & { ok?: boolean }) | null
          if (data?.ok === true) setReward(data as ContentRewardPublic)
        })
        .catch(() => { /* preserve the last confirmed reward */ })
        .finally(() => setLoading(false))
    }
    window.addEventListener("ghc:content-reward-updated", onRewardUpdated)
    return () => window.removeEventListener("ghc:content-reward-updated", onRewardUpdated)
  }, [postId])

  const up = reward?.upvoteCount ?? upvoteCount
  const down = reward?.downvoteCount ?? downvoteCount
  const r = reward as Record<string, unknown> | null
  const total = num(r?.totalEarned)
  const author = num(r?.authorShare ?? r?.authorReward)
  const curator = num(r?.curatorShare ?? r?.curationReward)
  const funded = num(r?.curationFunded)
  const showMoney =
    reward?.enabled === true &&
    Number.isFinite(total) &&
    total > 0 &&
    (reward.status === "accruing" ||
      reward.status === "finalized" ||
      reward.status === "distributed")

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums text-muted-foreground transition hover:bg-muted/50"
        aria-label={showMoney ? "View GHC reward" : "View votes"}
      >
        {showMoney ? (
          <span className="text-emerald-700 dark:text-emerald-400">
            {formatGhc(total)}
            <span className="ml-0.5 text-[10px] opacity-70">▾</span>
          </span>
        ) : (
          <span>{loading ? "…" : `${up}↑ · ${down}↓`}</span>
        )}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Post reward"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-border/50 bg-card p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">{showMoney ? "Reward" : "Votes"}</h2>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {showMoney ? (
              <div className="space-y-3">
                <p className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {formatGhc(total)} <span className="text-sm font-semibold">GHC</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Number.isFinite(author) ? (
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Creator received</p>
                      <p className="font-semibold tabular-nums">{formatGhc(author)}</p>
                    </div>
                  ) : null}
                  {Number.isFinite(funded) && funded > 0 ? (
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Curation funded</p>
                      <p className="font-semibold tabular-nums">{formatGhc(funded)}</p>
                    </div>
                  ) : null}
                  {Number.isFinite(curator) && curator > 0 ? (
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Curation pool</p>
                      <p className="font-semibold tabular-nums">{formatGhc(curator)}</p>
                    </div>
                  ) : null}
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {up} up · {down} down
                  {reward?.status ? ` · ${reward.status}` : ""}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm tabular-nums">
                  {up} up · {down} down
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Votes help the community surface useful posts; they do not mint GHC by themselves. Any reward shown here must be confirmed by GreenHaven&apos;s server.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
