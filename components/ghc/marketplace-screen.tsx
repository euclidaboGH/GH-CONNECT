"use client"

/**
 * GreenHaven Marketplace — product surface.
 * Visual-only presentation over existing marketplace domain data.
 * Never fabricates listings, prices, sellers, or orders.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Search,
  ShoppingBag,
  Package,
  X,
  MessageCircle,
  Store,
  Tag,
} from "lucide-react"
import { getMarketplaceDomain } from "@/lib/domains/compat"
import {
  MARKETPLACE_CATEGORIES,
  type MarketplaceListing,
  type MarketplaceOrder,
} from "@/lib/domains/marketplace-domain"
import { messageListingSeller, openPayForListing } from "@/lib/marketplace/commerce-actions"
import { EmptyState } from "./empty-state"

function formatPrice(listing: MarketplaceListing): string {
  const amount = Number(listing.price)
  if (!Number.isFinite(amount)) return "—"
  const cur = (listing.currency || "GHC").toUpperCase()
  if (cur === "GHC") return `${amount} GHC`
  if (cur === "PI" || cur === "π") return `${amount} π`
  return `${amount} ${cur}`
}

function kindLabel(kind: MarketplaceListing["kind"]): string {
  if (kind === "service") return "Service"
  if (kind === "opportunity") return "Opportunity"
  return "Product"
}

function statusChip(status: MarketplaceListing["status"]): { label: string; className: string } {
  if (status === "active")
    return { label: "Available", className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" }
  if (status === "sold_out")
    return { label: "Sold out", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200" }
  if (status === "paused")
    return { label: "Paused", className: "bg-muted text-muted-foreground" }
  return { label: status, className: "bg-muted text-muted-foreground" }
}

function ListingCard({
  listing,
  onOpen,
}: {
  listing: MarketplaceListing
  onOpen: (id: string) => void
}) {
  const chip = statusChip(listing.status)
  const media = listing.media?.[0]
  return (
    <button
      type="button"
      onClick={() => onOpen(listing.id)}
      className="flex w-full flex-col overflow-hidden rounded-[1.25rem] border border-border/50 bg-card text-left shadow-[var(--gh-card-shadow)] transition hover:border-border active:scale-[0.99]"
      aria-label={`${listing.title}, ${formatPrice(listing)}`}
    >
      <div className="relative aspect-[4/3] w-full bg-muted/50">
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="gh-icon-tile flex h-12 w-12 items-center justify-center rounded-2xl">
              <Package size={22} strokeWidth={2} aria-hidden />
            </span>
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.className}`}
        >
          {chip.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
          {listing.title}
        </p>
        <p className="text-[15px] font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
          {formatPrice(listing)}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {kindLabel(listing.kind)}
          </span>
          {listing.category ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {listing.category}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function ListingDetail({
  listing,
  onBack,
}: {
  listing: MarketplaceListing
  onBack: () => void
}) {
  const chip = statusChip(listing.status)
  const media = listing.media?.[0]
  const canBuy = listing.status === "active"

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Back to listings"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-foreground">Listing</h1>
          <p className="truncate text-[11px] text-muted-foreground">{kindLabel(listing.kind)}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-3">
        <div className="overflow-hidden rounded-[1.25rem] border border-border/50 bg-card shadow-[var(--gh-card-shadow)]">
          <div className="relative aspect-[16/10] w-full bg-muted/40">
            {media ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package size={40} className="text-muted-foreground/50" aria-hidden />
              </div>
            )}
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-bold leading-snug text-foreground">{listing.title}</h2>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.className}`}>
                {chip.label}
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
              {formatPrice(listing)}
            </p>
            {listing.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {listing.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <Tag size={12} aria-hidden />
                {listing.category || "General"}
              </span>
              {listing.location ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {listing.location}
                </span>
              ) : null}
              {typeof listing.availability === "number" ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Qty {listing.availability}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {canBuy ? (
            <button
              type="button"
              onClick={() =>
                openPayForListing(
                  {
                    listingId: listing.id,
                    sellerId: listing.sellerId,
                    title: listing.title,
                  },
                  listing.currency?.toUpperCase() === "GHC" ? "ghc" : "pi",
                )
              }
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--gh-green)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
            >
              Continue to payment
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              messageListingSeller({
                listingId: listing.id,
                sellerId: listing.sellerId,
                title: listing.title,
              })
            }
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted"
          >
            <MessageCircle size={16} aria-hidden />
            Message seller
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Prices and availability come from the listing owner. Payments use existing GH Pay / wallet flows —
          nothing is charged until you confirm.
        </p>
      </div>
    </div>
  )
}

export function MarketplaceScreen({
  onBack,
  initialListingId,
}: {
  onBack: () => void
  initialListingId?: string | null
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialListingId || null)
  const [bucket, setBucket] = useState<"browse" | "orders">("browse")
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    const onListing = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const id =
        detail && typeof detail === "object" && typeof (detail as { listingId?: unknown }).listingId === "string"
          ? String((detail as { listingId: string }).listingId).trim()
          : ""
      if (id) setSelectedId(id)
    }
    window.addEventListener("ghc:open-listing", onListing)
    return () => window.removeEventListener("ghc:open-listing", onListing)
  }, [])

  useEffect(() => {
    if (initialListingId) setSelectedId(initialListingId)
  }, [initialListingId])

  const domain = getMarketplaceDomain()

  const listings = useMemo(() => {
    void tick
    if (!domain?.listListings) return [] as MarketplaceListing[]
    return domain.listListings({
      category: category || undefined,
      query: query.trim() || undefined,
    })
  }, [domain, category, query, tick])

  const orders = useMemo(() => {
    void tick
    if (!domain?.getOrders) return [] as MarketplaceOrder[]
    try {
      return domain.getOrders?.() || []
    } catch {
      return []
    }
  }, [domain, tick])

  const selected = useMemo(() => {
    if (!selectedId) return null
    if (domain?.getListing) return domain.getListing(selectedId) || null
    return listings.find((l) => l.id === selectedId) || null
  }, [selectedId, domain, listings])

  if (selected) {
    return <ListingDetail listing={selected} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-border/50 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">Marketplace</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Buy &amp; sell with π or GHC
            </p>
          </div>
          <span className="gh-icon-tile flex h-10 w-10 items-center justify-center rounded-2xl" aria-hidden>
            <ShoppingBag size={18} />
          </span>
        </div>

        <div className="flex gap-1 rounded-2xl border border-border/50 bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setBucket("browse")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold transition ${
              bucket === "browse"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store size={14} aria-hidden />
            Browse
          </button>
          <button
            type="button"
            onClick={() => setBucket("orders")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold transition ${
              bucket === "orders"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package size={14} aria-hidden />
            Orders
          </button>
        </div>

        {bucket === "browse" ? (
          <>
            <label className="relative block w-full">
              <span className="sr-only">Search listings</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search listings…"
                className="h-11 w-full rounded-xl border border-border/70 bg-card pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              ) : null}
            </label>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  !category
                    ? "bg-[var(--gh-green)] text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {MARKETPLACE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    category === c
                      ? "bg-[var(--gh-green)] text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-3">
        {bucket === "orders" ? (
          orders.length === 0 ? (
            <EmptyState
              variant="transactions"
              title="No orders yet"
              description="When you buy or sell on Marketplace, order status will appear here from the existing order flow."
              icon={Package}
            />
          ) : (
            <ul className="space-y-2.5">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-[1.25rem] border border-border/50 bg-card p-3.5 shadow-[var(--gh-card-shadow)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        Order · {o.listingId}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {o.quantity} × {o.unitPrice} {o.currency}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {o.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {new Date(o.updatedAt || o.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center px-2 pt-6">
            <EmptyState
              variant="search"
              title={query || category ? "No matching listings" : "Marketplace is ready"}
              description={
                query || category
                  ? "Try another search or category. Only real listings from sellers appear here."
                  : "When members publish listings through the existing marketplace flow, they show up here with real prices and availability. Nothing is invented to fill the grid."
              }
              icon={ShoppingBag}
            />
            <button
              type="button"
              onClick={refresh}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} onOpen={setSelectedId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
