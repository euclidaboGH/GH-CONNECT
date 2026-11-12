"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BarChart3, CircleCheck, CircleHelp, RefreshCw, ShieldCheck, Video } from "lucide-react"

type CreatorOverview = {
  ok?: boolean
  durable?: boolean
  dataQuality?: { complete?: boolean; sources?: { creatorProfile?: boolean; publishedPosts?: boolean; creatorEconomy?: boolean; reputation?: boolean } }
  creator?: { exists?: boolean; displayName?: string | null; tagline?: string | null; bio?: string | null; isEnabled?: boolean; tipsEnabled?: boolean }
  posts?: unknown[]
  creatorEconomy?: { ok?: boolean }
  reputation?: { level?: number; levelName?: string; totalPoints?: number } | null
}

function SourceStatus({ ready, label }: { ready: boolean; label: string }) {
  return <li className="flex items-center gap-2 text-xs"><span className={ready ? "text-emerald-700" : "text-muted-foreground"}>{ready ? <CircleCheck className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}</span><span>{label}</span><span className="ml-auto text-muted-foreground">{ready ? "Available" : "Unavailable"}</span></li>
}

export function CreatorToolsScreen({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<CreatorOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/social/creator", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal })
    const payload = await response.json().catch(() => null) as CreatorOverview | null
    if (signal?.aborted) return
    if (!response.ok || payload?.ok !== true || payload.durable !== true) throw new Error("Creator data is not currently available from the server")
    setData(payload)
    setError(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    void refresh(controller.signal)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Creator data is unavailable") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); requestRef.current = null }
  }, [refresh])

  const retry = useCallback(() => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(null)
    void refresh(controller.signal)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Creator data is unavailable") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
  }, [refresh])

  const sources = data?.dataQuality?.sources
  const reputation = data?.reputation
  const postsAvailable = sources?.publishedPosts === true

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-labelledby="creator-tools-title">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        {onBack ? <button type="button" onClick={onBack} className="min-h-11 min-w-11 rounded-full border border-border text-sm" aria-label="Back">←</button> : null}
        <div className="min-w-0 flex-1"><h1 id="creator-tools-title" className="text-base font-semibold">Creator Tools</h1><p className="text-xs text-muted-foreground">Your publishing and creator account overview</p></div>
        <Video className="h-6 w-6 text-emerald-700" aria-hidden="true" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 rounded-2xl border border-border bg-muted/40 p-4"><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Server-verified creator overview</div><p className="mt-2 text-xs leading-5 text-muted-foreground">This view reads your own creator profile, published posts and reputation from GreenHaven's existing services. It does not initiate tips, payouts or reward claims.</p></div>
        {error ? <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><span>{error}</span><button type="button" onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><RefreshCw className="h-4 w-4" /> Retry</button></div> : null}
        {loading ? <div className="grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /></div> : null}
        {!loading && data ? <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Creator profile</p>
            <h2 className="mt-2 text-lg font-semibold">{data.creator?.displayName || (data.creator?.exists ? "Creator profile" : "Creator profile not enabled")}</h2>
            {data.creator?.tagline ? <p className="mt-1 text-sm text-muted-foreground">{data.creator.tagline}</p> : null}
            {data.creator?.bio ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{data.creator.bio}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-muted px-3 py-1 text-[11px]">{data.creator?.isEnabled ? "Creator enabled" : "Creator not enabled"}</span><span className="rounded-full bg-muted px-3 py-1 text-[11px]">Tips {data.creator?.tipsEnabled ? "enabled" : "disabled"}</span></div>
          </section>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Published posts</p><p className="mt-2 text-2xl font-bold tabular-nums">{postsAvailable ? (data.posts?.length ?? 0).toLocaleString() : "—"}</p><p className="mt-1 text-[11px] text-muted-foreground">{postsAvailable ? "Owned posts returned by the server" : "Post data unavailable; no zero is assumed"}</p></div>
            <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Reputation</p><p className="mt-2 text-2xl font-bold">{reputation?.levelName || "—"}</p><p className="mt-1 text-[11px] text-muted-foreground">{Number.isSafeInteger(reputation?.totalPoints) ? `${Number(reputation?.totalPoints).toLocaleString()} points` : "Reputation data unavailable"}</p></div>
          </div>
          <section className="mt-4 rounded-2xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-700" /><h2 className="text-sm font-semibold">Data source health</h2></div><ul className="space-y-3"><SourceStatus ready={sources?.creatorProfile === true} label="Creator profile" /><SourceStatus ready={sources?.publishedPosts === true} label="Published content" /><SourceStatus ready={sources?.creatorEconomy === true} label="Creator ledger aggregation" /><SourceStatus ready={sources?.reputation === true} label="Reputation" /></ul>{data.dataQuality?.complete !== true ? <p className="mt-3 text-[11px] text-muted-foreground">Some source data is unavailable. Incomplete data is shown as unavailable, not as a zero balance or completed result.</p> : null}</section>
        </> : null}
      </div>
    </section>
  )
}
