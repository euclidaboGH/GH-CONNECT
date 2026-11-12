"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BriefcaseBusiness, MapPin, RefreshCw, Search } from "lucide-react"
import { formatServicePrice, normalizeServiceDirectoryListing, type ServiceDirectoryListing } from "@/lib/ecosystem/services-directory"

type ApiPayload = { ok?: boolean; durable?: boolean; error?: string; listings?: unknown[]; pagination?: { hasMore?: boolean; offset?: number; returned?: number } }

export function ServicesDirectoryScreen({ onBack, onOpenMarketplace }: { onBack?: () => void; onOpenMarketplace?: (listingId: string) => void }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [listings, setListings] = useState<ServiceDirectoryListing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const limit = 30

  const load = useCallback(async (nextOffset: number, append: boolean, signal?: AbortSignal) => {
    const params = new URLSearchParams({ kind: "service", limit: String(limit), offset: String(nextOffset), sort: "updated_at", direction: "desc" })
    if (query.trim()) params.set("q", query.trim())
    if (category) params.set("category", category)
    const response = await fetch(`/api/marketplace/listings?${params.toString()}`, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal })
    const payload = await response.json().catch(() => null) as ApiPayload | null
    if (signal?.aborted) return
    if (!response.ok || payload?.ok !== true || payload.durable !== true || !Array.isArray(payload.listings)) throw new Error(payload?.error || "Service listings are unavailable")
    const rows = payload.listings.map(normalizeServiceDirectoryListing).filter((row): row is ServiceDirectoryListing => row !== null)
    setListings((current) => {
      if (!append) return rows
      const byId = new Map(current.map((row) => [row.id, row]))
      for (const row of rows) byId.set(row.id, row)
      return [...byId.values()]
    })
    setOffset(nextOffset + (Number.isSafeInteger(payload.pagination?.returned) ? Number(payload.pagination?.returned) : rows.length))
    setHasMore(payload.pagination?.hasMore === true)
    setError(null)
  }, [category, query])

  useEffect(() => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setLoadingMore(false)
    setListings([])
    setOffset(0)
    setHasMore(false)
    const timer = window.setTimeout(() => {
      void load(0, false, controller.signal)
        .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Service listings are unavailable") })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, query ? 220 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [load, query, category])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoadingMore(true)
    try { await load(offset, true, controller.signal) }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "More services are unavailable") }
    finally { if (!controller.signal.aborted) setLoadingMore(false) }
  }, [hasMore, load, loading, loadingMore, offset])

  const categories = useMemo(() => Array.from(new Set(listings.map((listing) => listing.category))).sort(), [listings])

  const openListing = useCallback((listingId: string) => {
    if (onOpenMarketplace) onOpenMarketplace(listingId)
    else window.dispatchEvent(new CustomEvent("ghc:open-listing", { detail: { listingId } }))
  }, [onOpenMarketplace])

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-labelledby="services-title">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        {onBack ? <button type="button" onClick={onBack} className="min-h-11 min-w-11 rounded-full border border-border text-sm" aria-label="Back">←</button> : null}
        <div className="min-w-0 flex-1"><h1 id="services-title" className="text-base font-semibold">Services</h1><p className="text-xs text-muted-foreground">Browse verified active service listings on Marketplace</p></div>
        <BriefcaseBusiness className="h-6 w-6 text-emerald-700" aria-hidden="true" />
      </header>
      <div className="grid shrink-0 gap-2 border-b border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 120))} placeholder="Search services" aria-label="Search services" className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
        <label className="sr-only" htmlFor="services-category">Service category</label><select id="services-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {error ? <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><span>{error}</span><button type="button" onClick={() => { requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller; setLoading(true); setError(null); void load(0, false, controller.signal).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Service listings are unavailable") }).finally(() => { if (!controller.signal.aborted) setLoading(false) }) }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><RefreshCw className="h-4 w-4" /> Retry</button></div> : null}
        {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><div className="h-36 animate-pulse rounded-2xl bg-muted" /><div className="h-36 animate-pulse rounded-2xl bg-muted" /></div> : null}
        {!loading && listings.length === 0 && !error ? <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center"><BriefcaseBusiness className="mb-3 h-9 w-9 text-muted-foreground" /><h2 className="text-sm font-semibold">No active service listings found</h2><p className="mt-1 text-xs text-muted-foreground">Only active, server-backed service listings appear here.</p></div> : null}
        {!loading && listings.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <article key={listing.id} className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{listing.category}</p><h2 className="mt-2 line-clamp-2 text-sm font-semibold">{listing.title}</h2><p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{listing.description || "No additional description supplied."}</p><div className="mt-auto flex items-end justify-between gap-2 pt-4"><div><p className="text-sm font-bold tabular-nums">{formatServicePrice(listing.price, listing.currency)}</p>{listing.location ? <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{listing.location}</p> : null}</div><button type="button" onClick={() => openListing(listing.id)} className="min-h-10 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground">View service</button></div></article>)}</div> : null}
        {hasMore && !loading ? <div className="flex justify-center py-5"><button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11 rounded-xl border border-border px-5 text-sm font-medium disabled:opacity-60">{loadingMore ? "Loading…" : "Load more services"}</button></div> : null}
      </div>
    </section>
  )
}
