"use client"

/** Post curation analytics. Reward values are server-authoritative; view count is supplied by the feed. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Activity, ChevronDown, ChevronUp, Coins, Eye, RefreshCw, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react"
import type { ContentRewardPublic } from "@/lib/content-reward/public-types"

function formatGhc(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value < 0 ? "−" : ""}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GHC`
}
function safeCount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}
function signedGhc(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GHC`
}

export function PostRewardPanel({
  postId,
  upvoteCount,
  downvoteCount,
  views = 0,
}: {
  postId: string
  upvoteCount: number
  downvoteCount: number
  views?: number
}) {
  const [reward, setReward] = useState<ContentRewardPublic | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [serverViews, setServerViews] = useState<number | null>(null)
  const [qualifiedViews, setQualifiedViews] = useState<number | null>(null)

  const refreshAnalytics = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    let headers: Record<string, string> = {}
    try {
      const { IdentityService } = await import("@/lib/identity/identity-service")
      headers = { ...(IdentityService.getAuthHeaders?.() || {}) }
    } catch { /* cookie session remains supported */ }
    const base = `/api/social/posts/${encodeURIComponent(postId)}`
    try {
      const [rewardResponse, insightsResponse] = await Promise.all([
        fetch(`${base}/reward`, { credentials: "include", headers, cache: "no-store" }),
        fetch(`${base}/insights`, { credentials: "include", headers, cache: "no-store" }),
      ])
      const [rewardData, insightsData] = await Promise.all([
        rewardResponse.json().catch(() => null) as Promise<(ContentRewardPublic & { ok?: boolean }) | null>,
        insightsResponse.json().catch(() => null) as Promise<{ ok?: boolean; durable?: boolean; metrics?: { views?: number; qualifiedViews?: number } | null } | null>,
      ])
      let failed = false
      if (rewardResponse.ok && rewardData?.ok === true) setReward(rewardData)
      else failed = true
      if (insightsResponse.ok && insightsData?.ok === true && insightsData.durable !== false && insightsData.metrics) {
        const nextViews = Number(insightsData.metrics.views)
        const nextQualified = Number(insightsData.metrics.qualifiedViews)
        if (Number.isFinite(nextViews)) setServerViews(Math.max(0, Math.floor(nextViews)))
        if (Number.isFinite(nextQualified)) setQualifiedViews(Math.max(0, Math.floor(nextQualified)))
      } else if (insightsResponse.status !== 401 && insightsResponse.status !== 403) {
        failed = true
      }
      setLoadError(failed)
    } catch {
      setLoadError(true)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [postId])

  useEffect(() => { void refreshAnalytics(); }, [refreshAnalytics])

  useEffect(() => {
    const onPostEngagement = (event: Event) => {
      const detail = (event as CustomEvent<{ postId?: string }>).detail
      if (detail?.postId === postId) void refreshAnalytics()
    }
    const onRewardUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ postId?: string }>).detail
      if (detail?.postId === postId) void refreshAnalytics()
    }
    window.addEventListener("ghc:post-engagement", onPostEngagement)
    window.addEventListener("ghc:content-reward-updated", onRewardUpdated)
    return () => {
      window.removeEventListener("ghc:post-engagement", onPostEngagement)
      window.removeEventListener("ghc:content-reward-updated", onRewardUpdated)
    }
  }, [postId, refreshAnalytics])

  useEffect(() => { setServerViews(null); setQualifiedViews(null); }, [postId])

  const up = safeCount(reward?.upvoteCount ?? upvoteCount)
  const down = safeCount(reward?.downvoteCount ?? downvoteCount)
  const viewCount = safeCount(serverViews ?? views)
  const status = reward?.status ?? "inactive"
  const hasRewardState = reward?.enabled === true && (status === "accruing" || status === "finalized" || status === "distributed")
  const total = hasRewardState ? reward?.totalEarned : null
  const author = hasRewardState ? reward?.authorReward : null
  const curation = hasRewardState ? reward?.curationReward : null
  const upImpact = hasRewardState ? reward?.upvoteImpact : null
  const downImpact = hasRewardState ? reward?.downvoteImpact : null
  const netImpact = hasRewardState ? reward?.netImpact : null
  const statusLabel = status === "accruing" ? "ACCRUING" : status === "finalized" ? "FINALIZED" : status === "distributed" ? "SETTLED" : status === "voided" ? "VOIDED" : "NOT ACTIVE"
  const split = useMemo(() => {
    const a = Number(author)
    const c = Number(curation)
    const sum = a + c
    if (!hasRewardState || !Number.isFinite(sum) || sum <= 0) return null
    return { author: Math.round((a / sum) * 100), curation: Math.round((c / sum) * 100) }
  }, [author, curation, hasRewardState])

  return (
    <section className="mx-2 mb-2 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-emerald-500/[0.045] shadow-sm sm:mx-3" aria-label="Post curation and earnings">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={`curation-stats-${postId}`}
        className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Activity size={17} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold tracking-wide text-foreground">Curation & post insights</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Eye size={12} aria-hidden /> {viewCount.toLocaleString()} views</span>
            <span className="inline-flex items-center gap-1"><ThumbsUp size={11} aria-hidden /> {up.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><ThumbsDown size={11} aria-hidden /> {down.toLocaleString()}</span>
          </span>
        </span>
        <span className="hidden max-w-[45%] text-right sm:block">
          <span className={`block text-xs font-extrabold tabular-nums ${hasRewardState ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>{hasRewardState ? formatGhc(total) : "Rewards pending"}</span>
          <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{statusLabel}</span>
        </span>
        <span className="shrink-0 text-muted-foreground">{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</span>
      </button>

      {expanded ? (
        <div id={`curation-stats-${postId}`} className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{hasRewardState ? "Total reward value" : "Reward overview"}</p>
              <p className={`mt-1 text-2xl font-black tracking-tight tabular-nums ${hasRewardState ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>{hasRewardState ? formatGhc(total) : "Not yet accruing"}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{hasRewardState && status === "accruing" ? "Accruing estimate · server-reported" : hasRewardState && status === "distributed" ? "Settled through the reward system" : hasRewardState ? "Finalized by the reward system" : "No reward amount is reported until GreenHaven activates a funded reward state."}</p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-wider ${hasRewardState ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted/45 text-muted-foreground"}`}><ShieldCheck size={11} aria-hidden /> {statusLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="👁️ Total views" value={viewCount.toLocaleString()} detail={serverViews == null ? "Feed estimate" : "Server-confirmed reach"} />
            <StatTile label="Upvotes" value={up.toLocaleString()} detail="Positive signals" tone="positive" />
            <StatTile label="Downvotes" value={down.toLocaleString()} detail="Critical signals" tone="negative" />
            <StatTile label="Net votes" value={(up - down).toLocaleString()} detail="Upvotes − downvotes" />
          </div>

          <div className="rounded-xl border border-border/60 bg-background/65 p-3">
            <div className="mb-2 flex items-center gap-2"><Coins size={15} className="text-emerald-600" aria-hidden /><h3 className="text-xs font-bold">Reward breakdown</h3><span className="ml-auto text-[9px] text-muted-foreground">GHC</span></div>
            <div className="space-y-2.5">
              <RewardLine label="Author rewards" amount={author} percent={split?.author} icon="creator" />
              <RewardLine label="Curation rewards" amount={curation} percent={split?.curation} icon="curator" />
            </div>
            {split ? <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`Author share ${split.author} percent; curation share ${split.curation} percent`}><div className="bg-emerald-500 transition-all" style={{ width: `${split.author}%` }} /><div className="bg-sky-500 transition-all" style={{ width: `${split.curation}%` }} /></div> : null}
            <p className="mt-2 text-[9px] leading-4 text-muted-foreground">The displayed split is derived from the reward values returned for this post; the server’s stored reward policy remains authoritative.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ImpactTile icon={<ThumbsUp size={14} />} label="Upvote impact" amount={upImpact} positive />
            <ImpactTile icon={<ThumbsDown size={14} />} label="Downvote impact" amount={downImpact} />
            <ImpactTile icon={<Activity size={14} />} label="Net impact" amount={netImpact} positive={typeof netImpact === "number" && netImpact >= 0} />
          </div>

          {qualifiedViews != null ? <p className="text-[10px] text-muted-foreground">Qualified views: {qualifiedViews.toLocaleString()} · viewers who met GreenHaven’s dwell-time threshold.</p> : null}
          {loadError ? <p role="status" className="text-[10px] text-amber-700 dark:text-amber-300">Some analytics could not refresh. Showing the latest confirmed data available.</p> : null}
          {!hasRewardState ? <p className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] leading-4 text-muted-foreground">Votes and views are engagement statistics, not a promise of payment. Rewards appear here only when a funded reward state is confirmed by GreenHaven’s server.</p> : null}
          {reward?.topContributors?.length ? <div className="border-t border-border/50 pt-2"><p className="mb-1.5 text-[10px] font-bold text-muted-foreground">Top curation contributors</p>{reward.topContributors.slice(0, 3).map((person) => <div key={person.username} className="flex items-center justify-between py-1 text-xs"><span>@{person.username}</span><span className="font-semibold tabular-nums">{formatGhc(person.amount)}</span></div>)}</div> : null}
          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2"><p className="text-[9px] text-muted-foreground">{loading ? "Refreshing server data…" : "Stats reflect the latest data available to this post."}</p><div className="flex items-center gap-1"><button type="button" onClick={() => void refreshAnalytics(true)} disabled={loading} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label="Refresh curation insights"><RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh</button><button type="button" onClick={() => setExpanded(false)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-muted-foreground hover:bg-muted" aria-label="Collapse curation insights"><X size={12} /> Collapse</button></div></div>
        </div>
      ) : null}
    </section>
  )
}

function StatTile({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-700 dark:text-emerald-300" : tone === "negative" ? "text-rose-700 dark:text-rose-300" : "text-foreground"
  return <div className="min-w-0 rounded-xl border border-border/50 bg-background/65 px-2.5 py-2"><p className="truncate text-[9px] font-semibold text-muted-foreground">{label}</p><p className={`mt-1 text-base font-extrabold tabular-nums ${color}`}>{value}</p><p className="mt-0.5 truncate text-[9px] text-muted-foreground">{detail}</p></div>
}

function RewardLine({ label, amount, percent, icon }: { label: string; amount: number | null | undefined; percent?: number; icon: "creator" | "curator" }) {
  return <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-semibold">{label}</p><p className="text-[9px] text-muted-foreground">{percent == null ? "Awaiting confirmed allocation" : `${percent}% of reported reward total`}</p></div><p className={`shrink-0 text-xs font-extrabold tabular-nums ${icon === "creator" ? "text-emerald-700 dark:text-emerald-300" : "text-sky-700 dark:text-sky-300"}`}>{formatGhc(amount)}</p></div>
}

function ImpactTile({ icon, label, amount, positive }: { icon: ReactNode; label: string; amount: number | null | undefined; positive?: boolean }) {
  const color = amount == null ? "text-muted-foreground" : positive ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
  return <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/65 p-2.5"><span className={color}>{icon}</span><div className="min-w-0"><p className="truncate text-[9px] font-semibold text-muted-foreground">{label}</p><p className={`mt-0.5 text-xs font-extrabold tabular-nums ${color}`}>{signedGhc(amount)}</p></div></div>
}
