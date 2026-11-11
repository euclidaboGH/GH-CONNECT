"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ExternalLink, MapPin, RefreshCw, Search, Users, Video } from "lucide-react"
import { openCommunity } from "@/lib/navigation/navigate"
import type { CommunityEventCard, CommunityEventCategory } from "@/lib/ecosystem/events-discovery"

const CATEGORIES: Array<{ value: CommunityEventCategory | ""; label: string }> = [
  { value: "", label: "All events" },
  { value: "meeting", label: "Meetings" },
  { value: "social", label: "Social" },
  { value: "workshop", label: "Workshops" },
  { value: "discussion", label: "Discussions" },
  { value: "celebration", label: "Celebrations" },
]

function formatEventDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Date to be confirmed"
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)
}

type ApiPayload = {
  ok?: boolean
  error?: string
  events?: CommunityEventCard[]
  pagination?: { nextOffset?: number; hasMore?: boolean }
}

export function EventsDiscoveryScreen({ onBack }: { onBack?: () => void }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CommunityEventCategory | "">("")
  const [events, setEvents] = useState<CommunityEventCard[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const pageSize = 30

  const loadPage = useCallback(async (offset: number, append: boolean, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
    if (query.trim()) params.set("q", query.trim())
    if (category) params.set("category", category)
    const response = await fetch(`/api/ecosystem/events?${params.toString()}`, {
      credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal,
    })
    const payload = await response.json().catch(() => null) as ApiPayload | null
    if (signal?.aborted) return
    if (!response.ok || payload?.ok !== true || !Array.isArray(payload.events)) {
      throw new Error(payload?.error || "Events could not be loaded")
    }
    setEvents((current) => {
      if (!append) return payload.events || []
      const merged = new Map(current.map((event) => [event.id, event]))
      for (const event of payload.events || []) merged.set(event.id, event)
      return [...merged.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    })
    setNextOffset(Number.isSafeInteger(payload.pagination?.nextOffset) ? Number(payload.pagination?.nextOffset) : offset + pageSize)
    setHasMore(payload.pagination?.hasMore === true)
    setError(null)
  }, [category, query])

  useEffect(() => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setLoadingMore(false)
    setEvents([])
    const timer = window.setTimeout(() => {
      setNextOffset(0)
      setHasMore(false)
      void loadPage(0, false, controller.signal)
        .catch((cause) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Events could not be loaded")
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, query ? 220 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadPage, query, category])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoadingMore(true)
    try { await loadPage(nextOffset, true, controller.signal) }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "More events could not be loaded") }
    finally { if (!controller.signal.aborted) setLoadingMore(false) }
  }, [hasMore, loadPage, loading, loadingMore, nextOffset])

  const submitRsvp = useCallback(async (event: CommunityEventCard) => {
    if (rsvpBusy || event.viewerRsvpStatus === "going") return
    setRsvpBusy(event.id)
    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(event.communityId)}/platform`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "event_rsvp", eventId: event.id, status: "going" }),
      })
      const payload = await response.json().catch(() => null) as { ok?: boolean; durable?: boolean; error?: string } | null
      if (!response.ok || payload?.ok !== true || payload.durable !== true) throw new Error(payload?.error || "Your RSVP could not be saved")
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, viewerRsvpStatus: "going" } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your RSVP could not be saved")
    } finally { setRsvpBusy(null) }
  }, [rsvpBusy])

  const filterLabel = useMemo(() => CATEGORIES.find((item) => item.value === category)?.label || "All events", [category])

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-labelledby="events-title">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        {onBack ? <button type="button" onClick={onBack} className="min-h-11 min-w-11 rounded-full border border-border text-sm" aria-label="Back">←</button> : null}
        <div className="min-w-0 flex-1">
          <h1 id="events-title" className="text-base font-semibold">Events</h1>
          <p className="text-xs text-muted-foreground">Discover events hosted by GreenHaven communities</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">Community events</span>
      </header>

      <div className="grid shrink-0 gap-2 border-b border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 120))} placeholder="Search events or communities" className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Search events" />
        </label>
        <label className="sr-only" htmlFor="events-category">Event category</label>
        <select id="events-category" value={category} onChange={(event) => setCategory(event.target.value as CommunityEventCategory | "")} className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {error ? <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><span>{error}</span><button type="button" onClick={() => { requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller; setError(null); setLoading(true); void loadPage(0, false, controller.signal).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Events could not be loaded") }).finally(() => { if (!controller.signal.aborted) setLoading(false) }) }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><RefreshCw className="h-4 w-4" /> Retry</button></div> : null}
        {loading ? <div className="grid gap-3 sm:grid-cols-2"><div className="h-40 animate-pulse rounded-2xl bg-muted" /><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div> : null}
        {!loading && events.length === 0 && !error ? <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center"><CalendarDays className="mb-3 h-9 w-9 text-muted-foreground" /><h2 className="text-sm font-semibold">No upcoming events found</h2><p className="mt-1 text-xs text-muted-foreground">Try another search or category. Events appear here when communities publish them.</p></div> : null}
        {!loading && events.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => <article key={event.id} className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold capitalize">{event.category}</span>{event.status === "ongoing" ? <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Happening now</span> : null}</div>
            <h2 className="line-clamp-2 text-sm font-semibold">{event.title}</h2>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{event.description}</p>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{formatEventDate(event.startsAt)}</span></p>
              <p className="flex items-start gap-2">{event.virtualLink ? <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span>{event.virtualLink ? "Online event" : event.location || "Location to be confirmed"}</span></p>
              <button type="button" onClick={() => openCommunity(event.communityId)} className="flex min-h-9 items-center gap-2 text-left font-medium text-foreground underline-offset-4 hover:underline"><Users className="h-3.5 w-3.5" /> {event.communityName}</button>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              {event.viewerRsvpStatus === "going" ? <span className="inline-flex min-h-10 items-center rounded-xl bg-muted px-3 text-xs font-semibold">You're going</span> : <button type="button" onClick={() => void submitRsvp(event)} disabled={Boolean(rsvpBusy)} className="min-h-10 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60">{rsvpBusy === event.id ? "Saving…" : "RSVP"}</button>}
              {event.virtualLink ? <a href={event.virtualLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border px-3 text-xs font-medium">Join online <ExternalLink className="h-3 w-3" /></a> : null}
            </div>
          </article>)}
        </div> : null}
        {hasMore && !loading ? <div className="flex justify-center py-5"><button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11 rounded-xl border border-border px-5 text-sm font-medium disabled:opacity-60">{loadingMore ? "Loading…" : "Load more events"}</button></div> : null}
        <div className="sr-only" aria-live="polite">Showing {events.length} events. Filter: {filterLabel}.</div>
      </div>
    </section>
  )
}
