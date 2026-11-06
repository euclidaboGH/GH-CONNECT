"use client"

/**
 * Post curation analytics: compact in-feed summary + an immersive detail sheet.
 * Analytics are fetched only when requested, never once for every card in the feed.
 * Reward values remain server-authoritative; engagement counts never mint GHC.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Activity, ArrowUpRight, CheckCircle2, ChevronRight, Coins, Eye, RefreshCw, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react"
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
  views,
}: {
  postId: string
  upvoteCount: number
  downvoteCount: number
  views?: number | null
}) {
  const [reward, setReward] = useState<ContentRewardPublic | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [serverViews, setServerViews] = useState<number | null>(null)
  const [qualifiedViews, setQualifiedViews] = useState<number | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const sequenceRef = useRef(0)
  const mountedRef = useRef(true)

  const refreshAnalytics = useCallback(async (showSpinner = false) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const sequence = ++sequenceRef.current
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    if (showSpinner) setLoading(true)
    try {
      let headers: Record<string, string> = {}
      try {
        const { IdentityService } = await import("@/lib/identity/identity-service")
        headers = { ...(IdentityService.getAuthHeaders?.() || {}) }
      } catch { /* cookie session remains supported */ }
      const base = `/api/social/posts/${encodeURIComponent(postId)}`
      const [rewardResponse, insightsResponse] = await Promise.all([
        fetch(`${base}/reward`, { credentials: "include", headers, cache: "no-store", signal: controller.signal }),
        fetch(`${base}/insights`, { credentials: "include", headers, cache: "no-store", signal: controller.signal }),
      ])
      const [rewardData, insightsData] = await Promise.all([
        rewardResponse.json().catch(() => null) as Promise<(ContentRewardPublic & { ok?: boolean }) | null>,
        insightsResponse.json().catch(() => null) as Promise<{ ok?: boolean; durable?: boolean; metrics?: { views?: number; qualifiedViews?: number } | null } | null>,
      ])
      if (!mountedRef.current || controller.signal.aborted || sequence !== sequenceRef.current) return
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
      if (mountedRef.current && !controller.signal.aborted && sequence === sequenceRef.current) setLoadError(true)
      else if (mountedRef.current && controller.signal.aborted && sequence === sequenceRef.current) setLoadError(true)
    } finally {
      window.clearTimeout(timeout)
      if (mountedRef.current && sequence === sequenceRef.current && showSpinner) setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sequenceRef.current += 1
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [])

  useEffect(() => {
    setReward(null)
    setServerViews(null)
    setQualifiedViews(null)
    setLoadError(false)
  }, [postId])

  useEffect(() => {
    if (open) void refreshAnalytics(true)
    else {
      requestRef.current?.abort()
      setLoading(false)
    }
  }, [open, refreshAnalytics])

  useEffect(() => {
    if (!open) return
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
  }, [open, postId, refreshAnalytics])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const triggerElement = triggerRef.current
    document.body.style.overflow = "hidden"
    const focusClose = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return }
      if (event.key !== "Tab" || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.offsetParent !== null)
      if (!focusable.length) { event.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusClose)
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
      triggerElement?.focus()
    }
  }, [open])

  const up = safeCount(reward?.upvoteCount ?? upvoteCount)
  const down = safeCount(reward?.downvoteCount ?? downvoteCount)
  const viewCount = serverViews ?? (views == null ? null : safeCount(views))
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
    <>
      <section className="mx-2 mb-2 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:mx-3" aria-label="Post curation and insights">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="group flex min-h-[3.65rem] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-emerald-500/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Activity size={18} aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-foreground">Post performance</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Eye size={11} aria-hidden /> {viewCount == null ? "— views" : `${viewCount.toLocaleString()} views`}</span>
              <span className="inline-flex items-center gap-1"><ThumbsUp size={11} aria-hidden /> {up.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1"><ThumbsDown size={11} aria-hidden /> {down.toLocaleString()}</span>
            </span>
          </span>
          <span className="hidden text-right sm:block">
            <span className="block text-[11px] font-bold tabular-nums text-foreground">{hasRewardState ? formatGhc(total) : "No active reward"}</span>
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{statusLabel}</span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition group-hover:bg-emerald-500/10 group-hover:text-emerald-700"><ArrowUpRight size={16} /></span>
        </button>
      </section>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[240] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`curation-title-${postId}`} tabIndex={-1} className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.65rem] border border-white/15 bg-[var(--card)] shadow-[0_24px_90px_rgba(0,0,0,.28)] sm:rounded-[1.65rem]">
            <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Activity size={19} /></span>
              <div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-700 dark:text-emerald-300">Creator analytics</p><h2 id={`curation-title-${postId}`} className="text-base font-extrabold tracking-tight">Post performance</h2></div>
              <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/75" aria-label="Close post performance"><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Views" value={viewCount == null ? "—" : viewCount.toLocaleString()} detail={serverViews == null ? (views == null ? "Not available" : "Feed count · not verified") : "Server-confirmed"} />
                <StatTile label="Upvotes" value={up.toLocaleString()} detail="Positive quality signals" tone="positive" />
                <StatTile label="Downvotes" value={down.toLocaleString()} detail="Critical quality signals" tone="negative" />
                <StatTile label="Net votes" value={(up - down).toLocaleString()} detail="Not a truth score" />
              </div>

              <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-emerald-500/[.09] via-card to-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-muted-foreground">Confirmed reward value</p><p className="mt-1 text-2xl font-black tracking-tight tabular-nums">{hasRewardState ? formatGhc(total) : "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">{hasRewardState ? status === "accruing" ? "Server-reported accrual estimate" : "Confirmed by the reward system" : "No funded reward state has been confirmed for this post."}</p></div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[9px] font-extrabold tracking-wider text-muted-foreground"><ShieldCheck size={11} /> {statusLabel}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-background/75 px-3 py-2 text-[10px] text-muted-foreground"><CheckCircle2 size={14} className="shrink-0 text-emerald-600" /> Votes and views are engagement signals; they do not create GHC or guarantee payment.</div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2"><Coins size={16} className="text-emerald-600" /><h3 className="text-xs font-bold">Reward allocation</h3><span className="ml-auto text-[9px] text-muted-foreground">GHC</span></div>
                <div className="space-y-3"><RewardLine label="Creator allocation" amount={author} percent={split?.author} icon="creator" /><RewardLine label="Curation allocation" amount={curation} percent={split?.curation} icon="curator" /></div>
                {split ? <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" aria-label={`Creator share ${split.author} percent; curation share ${split.curation} percent`}><div className="bg-emerald-500" style={{ width: `${split.author}%` }} /><div className="bg-sky-500" style={{ width: `${split.curation}%` }} /></div> : <p className="mt-3 text-[10px] text-muted-foreground">Allocation details appear only when the server confirms a funded reward state.</p>}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><ImpactTile icon={<ThumbsUp size={14} />} label="Upvote impact" amount={upImpact} positive /><ImpactTile icon={<ThumbsDown size={14} />} label="Downvote impact" amount={downImpact} /><ImpactTile icon={<Activity size={14} />} label="Net impact" amount={netImpact} positive={typeof netImpact === "number" && netImpact >= 0} /></div>
              {qualifiedViews != null ? <p className="text-[10px] text-muted-foreground">Qualified views: {qualifiedViews.toLocaleString()} · met GreenHaven’s dwell-time threshold.</p> : null}
              {reward?.topContributors?.length ? <div className="rounded-2xl border border-border/70 p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top curation contributors</p>{reward.topContributors.slice(0, 3).map((person) => <div key={person.username} className="flex items-center justify-between py-1.5 text-xs"><span>@{person.username}</span><span className="font-semibold tabular-nums">{formatGhc(person.amount)}</span></div>)}</div> : null}
              {loadError ? <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-800 dark:text-amber-200">Analytics could not be refreshed. Showing only the latest available figures; retry when connected.</p> : null}
              {loading ? <p role="status" className="text-center text-[10px] text-muted-foreground">Refreshing secure server analytics…</p> : null}
            </div>
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5">
              <p className="text-[9px] text-muted-foreground">Private creator view · server-authoritative rewards</p>
              <button type="button" onClick={() => void refreshAnalytics(true)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh</button>
            </footer>
          </section>
        </div>, document.body
      ) : null}
    </>
  )
}

function StatTile({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-700 dark:text-emerald-300" : tone === "negative" ? "text-rose-700 dark:text-rose-300" : "text-foreground"
  return <div className="min-w-0 rounded-xl border border-border/60 bg-background/75 px-3 py-3"><p className="truncate text-[9px] font-semibold text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-extrabold tabular-nums ${color}`}>{value}</p><p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">{detail}</p></div>
}
function RewardLine({ label, amount, percent, icon }: { label: string; amount: number | null | undefined; percent?: number; icon: "creator" | "curator" }) {
  return <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-semibold">{label}</p><p className="text-[9px] text-muted-foreground">{percent == null ? "Awaiting confirmed allocation" : `${percent}% of reported reward total`}</p></div><p className={`shrink-0 text-xs font-extrabold tabular-nums ${icon === "creator" ? "text-emerald-700 dark:text-emerald-300" : "text-sky-700 dark:text-sky-300"}`}>{formatGhc(amount)}</p></div>
}
function ImpactTile({ icon, label, amount, positive }: { icon: ReactNode; label: string; amount: number | null | undefined; positive?: boolean }) {
  const color = amount == null ? "text-muted-foreground" : positive ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
  return <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/75 p-3"><span className={color}>{icon}</span><div className="min-w-0"><p className="truncate text-[9px] font-semibold text-muted-foreground">{label}</p><p className={`mt-0.5 text-xs font-extrabold tabular-nums ${color}`}>{signedGhc(amount)}</p></div></div>
}
