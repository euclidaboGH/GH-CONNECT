import { isPiOnlyCommerceClient } from "@/lib/client/pi-only-commerce"
"use client"

/**
 * GreenHaven Marketplace — product surface.
 * Visual-only presentation over existing marketplace domain data.
 * Never fabricates listings, prices, sellers, or orders.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Search,
  ShoppingBag,
  Package,
  X,
  MessageCircle,
  Store,
  Tag,
  Share2,
  Bookmark,
  MoreHorizontal,
  MapPin,
  Plus,
  Tag as TagIcon,
  Loader2,
} from "lucide-react"
import { getMarketplaceDomain, getCommunityDomain } from "@/lib/domains/compat"
import {
  MARKETPLACE_CATEGORIES,
  type MarketplaceListing,
  type MarketplaceOrder,
} from "@/lib/domains/marketplace-domain"
import { messageListingSeller, openPayForListing } from "@/lib/marketplace/commerce-actions"
import { openCommunity } from "@/lib/navigation/navigate"
import { EmptyState } from "./empty-state"
import { LazyImage } from "./lazy-image"
import { socialFetchMarketplaceSaved, socialToggleMarketplaceSaved } from "@/lib/social/client"
import { IdentityService } from "@/lib/identity/identity-service"
import { startUserToAppPayment } from "@/lib/pi-u2a-payment"
import { uploadDurableMedia } from "@/lib/media/upload-client"
import { toRelativeMediaFacadeUrl } from "@/lib/media/resolve-display-url"
import {
  formatListingFeeCta,
  quoteListingCreateFee,
  quoteListingEditFee,
  type ListingFeeRail,
} from "@/lib/marketplace/listing-fee-client"

function formatPrice(listing: MarketplaceListing): string {
  const amount = Number(listing.price)
  if (!Number.isFinite(amount)) return "—"
  const cur = (listing.currency || "GHC").toUpperCase()
  if (cur === "GHC") {
    return `₲ ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }
  if (cur === "PI" || cur === "π") return `${amount} π`
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cur}`
}

function listedWhen(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return ""
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days < 1) return "Listed today"
  if (days === 1) return "Listed yesterday"
  if (days < 14) return `Listed ${days} days ago`
  if (days < 60) return `Listed ${Math.floor(days / 7)} weeks ago`
  return `Listed ${new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
}


/** Build related search chips from real listing text — never invent products. */
function relatedSearchTokens(listing: MarketplaceListing): string[] {
  const stop = new Set(
    "a an the and or for with from this that available location each eachs is are in on of to".split(" "),
  )
  const raw = `${listing.title} ${listing.category || ""} ${(listing.tags || []).join(" ")} ${listing.description || ""}`
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/gi, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stop.has(w) && !/^\d+$/.test(w))
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= 8) break
  }
  if (listing.category && !seen.has(listing.category.toLowerCase())) {
    out.unshift(listing.category)
  }
  return out.slice(0, 6)
}

function relatedListingsFor(listing: MarketplaceListing, limit = 6): MarketplaceListing[] {
  const domain = getMarketplaceDomain()
  if (!domain?.listListings) return []
  const all = domain.listListings({ status: "active" }) || []
  const cat = (listing.category || "").toLowerCase()
  const tokens = new Set(relatedSearchTokens(listing).map((t) => t.toLowerCase()))
  const scored = all
    .filter((l) => l.id !== listing.id && l.status === "active")
    .map((l) => {
      let score = 0
      if (cat && (l.category || "").toLowerCase() === cat) score += 5
      const hay = `${l.title} ${l.category} ${(l.tags || []).join(" ")}`.toLowerCase()
      for (const t of tokens) {
        if (hay.includes(t)) score += 1
      }
      return { l, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.l)
}

type CommunitySuggest = { id: string; name: string; memberCount?: number; photo?: string }

function suggestedCommunitiesFor(listing: MarketplaceListing, limit = 5): CommunitySuggest[] {
  try {
    const domain = getCommunityDomain()
    if (!domain?.listCommunities) return []
    const list = domain.listCommunities() || []
    const tokens = relatedSearchTokens(listing).map((t) => t.toLowerCase())
    const cat = (listing.category || "").toLowerCase()
    const scored = list.map((c: {
      id: string
      name?: string
      groupName?: string
      members?: string[]
      memberIds?: string[]
      groupPhoto?: string
      participantPhoto?: string
    }) => {
      const name = (c.name || c.groupName || "").trim()
      const hay = name.toLowerCase()
      let score = 0
      if (cat && hay.includes(cat)) score += 4
      for (const t of tokens) {
        if (hay.includes(t)) score += 2
      }
      const memberCount = Array.isArray(c.members)
        ? c.members.length
        : Array.isArray(c.memberIds)
          ? c.memberIds.length
          : undefined
      return {
        id: c.id,
        name: name || "Community",
        memberCount,
        photo: c.groupPhoto || c.participantPhoto,
        score,
      }
    })
    return scored
      .filter((x) => x.score > 0 && x.id)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ id, name, memberCount, photo }) => ({ id, name, memberCount, photo }))
  } catch {
    return []
  }
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
          <LazyImage
            src={media}
            alt={listing.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-w-0 max-w-full w-full items-center justify-center">
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
        <p className="text-[15px] font-bold tracking-tight text-foreground">
          {formatPrice(listing)}
        </p>
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-muted-foreground">
          {listing.title}
        </p>
        {listing.location ? (
          <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] text-muted-foreground">
            <MapPin size={11} className="shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{listing.location}</span>
          </p>
        ) : null}
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


function CheckoutPanel({ listing }: { listing: MarketplaceListing }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const listingCur = (listing.currency || "GHC").toUpperCase()
  // Orders are settled in the listing's server-authoritative currency. Do not offer
  // a second rail unless a verified conversion/dual-currency quote exists.
  const requiredRail: "ghc" | "pi" = listingCur === "PI" ? "pi" : "ghc"
  const [payRail, setPayRail] = useState<"ghc" | "pi">(requiredRail)
  const viewerId = IdentityService.getCurrentUserId() || ""
  const isOwn = Boolean(viewerId && listing.sellerId && viewerId === listing.sellerId)

  const runCheckout = async () => {
    if (busy || isOwn) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const { socialCreateMarketplaceOrder, socialPayMarketplaceOrder } = await import(
        "@/lib/social/client"
      )
      const created = await socialCreateMarketplaceOrder({
        listingId: listing.id,
        quantity: 1,
        idempotencyKey: `buy_${listing.id}_${viewerId || "anon"}_${Math.floor(Date.now() / 60_000)}`,
      })
      if (!created.ok || !created.order) {
        const errCode = !created.ok ? String(created.error || "") : ""
        setErr(
          errCode === "CANNOT_BUY_OWN"
            ? "Cannot buy your own listing"
            : errCode || "Could not create order",
        )
        return
      }
      const orderId = String((created.order as { id?: string }).id || "")
      if (!orderId) {
        setErr("Order created without id")
        return
      }
      emitMarketplaceEconomyRefresh("marketplace-order-create")

      if (payRail === "pi") {
        setMsg("Order reserved. Complete Pi payment to confirm.")
        openPayForListing(
          {
            listingId: listing.id,
            sellerId: listing.sellerId,
            title: listing.title,
            orderId,
          },
          "pi",
        )
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:toast", {
              detail: { message: "Order ready — complete Pi payment", type: "info" },
            }),
          )
        } catch {
          /* */
        }
        return
      }

      const paid = await socialPayMarketplaceOrder(orderId, "ghc")
      if (!paid.ok) {
        setErr(paid.message || paid.error || "GHC payment failed — check available balance")
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:toast", {
              detail: { message: paid.error || "Payment failed", type: "error" },
            }),
          )
        } catch {
          /* */
        }
        return
      }
      setMsg("Paid with GHC. Order confirmed — track it under Orders.")
      emitMarketplaceEconomyRefresh("marketplace-order-paid-ghc")
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: { message: "Order paid with GHC", type: "success" },
          }),
        )
        window.dispatchEvent(new CustomEvent("ghc:marketplace-order-changed"))
      } catch {
        /* */
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  if (isOwn) {
    return (
      <p className="mt-3 text-center text-xs font-medium text-red-600 dark:text-red-400">
        Cannot buy your own listing
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        {([requiredRail] as const).map((rail) => (
          <button
            key={rail}
            type="button"
            onClick={() => setPayRail(rail)}
            className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-bold transition ${
              payRail === rail
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-border/70 bg-card text-muted-foreground"
            }`}
          >
            {rail === "ghc" ? "Pay with ₲ GHC" : "Pay with π Pi"}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void runCheckout()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--gh-green)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
        {busy
          ? "Processing…"
          : payRail === "ghc"
            ? `Buy now · ${formatPrice(listing)}`
            : `Continue · pay with π · ${formatPrice(listing)}`}
      </button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {payRail === "ghc"
          ? "This listing is priced in GHC. Payment debits available GHC on the durable ledger; seller settlement follows fulfillment."
          : "This listing is priced in Pi. Inventory is reserved and Pi payment is verified against a server-created intent. No currency conversion is implied."}
      </p>
      {msg ? <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{msg}</p> : null}
      {err ? <p className="text-xs font-medium text-red-600 dark:text-red-400">{err}</p> : null}
    </div>
  )
}

function ListingDetail({
  listing,
  onBack,
  onOpenListing,
  onSearchBrowse,
  onEditListing,
  onDelist,
  onRemoveListing,
}: {
  listing: MarketplaceListing
  onBack: () => void
  onOpenListing?: (id: string) => void
  onSearchBrowse?: (q: string) => void
  onEditListing?: (listing: MarketplaceListing) => void
  onDelist?: (listing: MarketplaceListing) => void
  onRemoveListing?: (listing: MarketplaceListing) => void
}) {
  const chip = statusChip(listing.status)
  const mediaItems = Array.isArray(listing.media) ? listing.media.filter(Boolean) : []
  const [mediaIndex, setMediaIndex] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const media = mediaItems[mediaIndex] || mediaItems[0]
  const canBuy = listing.status === "active"
  const viewerId = IdentityService.getCurrentUserId() || ""
  const isOwner = Boolean(viewerId && listing.sellerId && viewerId === listing.sellerId)
  const relatedTokens = useMemo(() => relatedSearchTokens(listing), [listing])
  const relatedItems = useMemo(() => relatedListingsFor(listing, 6), [listing])
  const communitySuggestions = useMemo(() => suggestedCommunitiesFor(listing, 5), [listing])
  const when = listedWhen(listing.createdAt)
  const locationLine = [listing.location, when].filter(Boolean).join(" · ")

  useEffect(() => {
    let cancelled = false
    void socialFetchMarketplaceSaved(100).then((result) => {
      if (cancelled || !result.ok || !result.durable) return
      setSaved(result.saved.some((row) => String(row.listingId || row.listing_id || "") === listing.id))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [listing.id])

  const toggleSaved = async () => {
    if (saveBusy) return
    setSaveBusy(true)
    try {
      const result = await socialToggleMarketplaceSaved(listing.id)
      if (!result.ok || !result.durable) throw new Error(result.error || "Saved listings are unavailable")
      setSaved(Boolean(result.saved))
      window.dispatchEvent(new CustomEvent("ghc:marketplace-saves-changed"))
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: result.saved ? "Listing saved" : "Listing removed from saved", type: "success" } }))
    } catch (error) {
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: error instanceof Error ? error.message : "Could not update saved listing", type: "error" } }))
    } finally {
      setSaveBusy(false)
    }
  }

  const quickTemplates = [
    "Is this still available?",
    "Is the price negotiable?",
    "Where can I pick this up?",
  ]

  const messageSeller = (template?: string) => {
    messageListingSeller({
      listingId: listing.id,
      sellerId: listing.sellerId,
      title: listing.title,
      messageTemplate: template
        ? `${template} (re: “${listing.title}” on GreenHaven Marketplace)`
        : undefined,
    })
  }

  const shareListing = async () => {
    const text = `${listing.title} · ${formatPrice(listing)}`
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: listing.title, text })
        return
      }
    } catch {
      /* */
    }
    try {
      await navigator.clipboard?.writeText?.(text)
    } catch {
      /* */
    }
  }

  return (
    <div className="gh-world-marketplace flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/50 px-2.5 py-1.5 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Back to listings"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold text-foreground">{listing.title}</h1>
        </div>
        <button
          type="button"
          onClick={() => void shareListing()}
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Search marketplace"
        >
          <Search size={18} className="text-muted-foreground" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Hero media */}
        <div className="relative aspect-[4/3] w-full bg-muted/40">
          {media ? (
            <LazyImage src={media} alt={listing.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package size={40} className="text-muted-foreground/50" aria-hidden />
            </div>
          )}
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${chip.className}`}>
            {chip.label}
          </span>
        </div>
        {mediaItems.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2" aria-label="Listing photos">
            {mediaItems.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setMediaIndex(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === mediaIndex ? "border-emerald-600" : "border-transparent"}`}
              >
                <LazyImage src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        {/* Title + price + meta (FB hierarchy) */}
        <div className="px-4 pt-3 pb-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{listing.title}</h2>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{formatPrice(listing)}</p>
          {locationLine ? (
            <p className="mt-1.5 flex items-center gap-1 text-[13px] text-muted-foreground">
              {listing.location ? <MapPin size={13} className="shrink-0 opacity-70" aria-hidden /> : null}
              <span className="truncate">{locationLine}</span>
            </p>
          ) : null}
        </div>

        {/* Message seller card */}
        <div className="mx-4 mt-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
          <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-foreground">
            <MessageCircle size={16} className="text-sky-600" aria-hidden />
            Message seller
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickTemplates.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => messageSeller(q)}
                className="rounded-full bg-muted/80 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => messageSeller()}
            className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 active:scale-[0.99]"
          >
            Send message
          </button>
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-start justify-around border-b border-border/50 px-2 py-3">
          {[
            { label: "Message", icon: MessageCircle, onClick: () => messageSeller() },
            { label: "Share", icon: Share2, onClick: () => void shareListing() },
            { label: saved ? "Saved" : "Save", icon: Bookmark, onClick: () => void toggleSaved() },
            {
              label: "More",
              icon: MoreHorizontal,
              onClick: () => {
                try {
                  window.dispatchEvent(
                    new CustomEvent("ghc:toast", {
                      detail: { message: "Report and more tools open from Settings when available", type: "info" },
                    }),
                  )
                } catch {
                  /* */
                }
              },
            },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.label === "Saved" && saveBusy}
              className={`flex w-16 flex-col items-center gap-1.5 text-muted-foreground ${a.label === "Saved" ? "text-emerald-700 dark:text-emerald-300" : ""}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/80">
                <a.icon size={18} aria-hidden />
              </span>
              <span className="text-[11px] font-medium">{a.label}</span>
            </button>
          ))}
        </div>

        {isOwner ? (
          <div className="mx-4 mt-3 space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[12px] font-bold text-foreground">Your listing</p>
            <p className="text-[11px] text-muted-foreground">
              Listing fees are non-refundable. Editing charges half the create fee.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-10 flex-1 rounded-full bg-[var(--gh-green)] px-3 text-sm font-bold text-white"
                onClick={() => onEditListing?.(listing)}
              >
                Edit
              </button>
              <button
                type="button"
                className="min-h-10 flex-1 rounded-full border border-border bg-card px-3 text-sm font-bold"
                onClick={() => void shareListing()}
              >
                Share
              </button>
              <button
                type="button"
                className="min-h-10 flex-1 rounded-full border border-border bg-card px-3 text-sm font-bold"
                onClick={() => onDelist?.(listing)}
              >
                Delist
              </button>
              <button
                type="button"
                className="min-h-10 flex-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 text-sm font-bold text-red-700 dark:text-red-300"
                onClick={() => onRemoveListing?.(listing)}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}

        {/* Description */}
        <section className="border-b border-border/50 px-4 py-4">
          <h3 className="text-[15px] font-bold text-foreground">Description</h3>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
            {listing.description?.trim() || "No description provided."}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {kindLabel(listing.kind)}
            </span>
            {listing.category ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {listing.category}
              </span>
            ) : null}
            {listing.condition ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {listing.condition}
              </span>
            ) : null}
            {typeof listing.availability === "number" ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                Qty {listing.availability}
              </span>
            ) : null}
          </div>
        </section>

        {/* Seller information */}
        <section className="border-b border-border/50 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-foreground">Seller information</h3>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Store size={20} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-foreground">Seller on GreenHaven</p>
              <p className="truncate text-[12px] text-muted-foreground">
                ID · {listing.sellerId ? `${listing.sellerId.slice(0, 8)}…` : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => messageSeller()}
              className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-[12px] font-bold text-foreground hover:bg-muted"
            >
              Message
            </button>
          </div>
          {listing.location ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-border/50 bg-muted/30 px-3 py-4">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <MapPin size={14} className="text-emerald-700" aria-hidden />
                {listing.location}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Location from the listing · not live GPS</p>
            </div>
          ) : null}
        </section>

        {/* Related listings — real domain data only */}
        {relatedItems.length > 0 ? (
          <section className="border-b border-border/50 px-4 py-4">
            <h3 className="text-[15px] font-bold text-foreground">Related listings</h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {relatedItems.map((rl) => (
                <button
                  key={rl.id}
                  type="button"
                  onClick={() => onOpenListing?.(rl.id)}
                  className="overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-sm active:scale-[0.99]"
                >
                  <div className="aspect-[4/3] bg-muted/40">
                    {rl.media?.[0] ? (
                      <LazyImage src={rl.media[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package size={20} className="text-muted-foreground/40" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[13px] font-bold text-foreground">{formatPrice(rl)}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{rl.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Suggested communities — only communities that already exist */}
        {communitySuggestions.length > 0 ? (
          <section className="border-b border-border/50 px-4 py-4">
            <h3 className="text-[15px] font-bold text-foreground">Suggested communities</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">From groups you already have on GreenHaven</p>
            <ul className="mt-3 space-y-2.5">
              {communitySuggestions.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {c.photo ? (
                      <img src={c.photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                        {(c.name || "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-foreground">{c.name}</p>
                    {typeof c.memberCount === "number" ? (
                      <p className="text-[11px] text-muted-foreground">
                        {c.memberCount.toLocaleString()} member{c.memberCount === 1 ? "" : "s"}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Community</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openCommunity(c.id)}
                    className="shrink-0 rounded-lg border border-sky-500 px-3 py-1.5 text-[12px] font-bold text-sky-600"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Related searches — tokens from this listing only */}
        {relatedTokens.length > 0 ? (
          <section className="border-b border-border/50 px-4 py-4">
            <h3 className="text-[15px] font-bold text-foreground">Related searches</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedTokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => onSearchBrowse?.(token)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-[12px] font-medium text-foreground hover:bg-muted/80"
                >
                  <Search size={13} className="text-muted-foreground" aria-hidden />
                  {token}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Purchase (kept, secondary to message-first hierarchy) */}
        <section className="px-4 py-4 pb-8">
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Purchase</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{formatPrice(listing)}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Price and availability are provided by the seller. Review payment details before confirming.
            </p>
            {canBuy ? (
              <CheckoutPanel listing={listing} />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}


function SellListingForm({
  mode = "create",
  title,
  setTitle,
  price,
  setPrice,
  currency,
  setCurrency,
  description,
  setDescription,
  category,
  setCategory,
  location,
  setLocation,
  mediaUrls,
  setMediaUrls,
  feeRail,
  setFeeRail,
  paymentIntentId,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  mode?: "create" | "edit"
  title: string
  setTitle: (v: string) => void
  price: string
  setPrice: (v: string) => void
  currency: "GHC" | "PI"
  setCurrency: (v: "GHC" | "PI") => void
  description: string
  setDescription: (v: string) => void
  category: string
  setCategory: (v: string) => void
  location: string
  setLocation: (v: string) => void
  mediaUrls: string[]
  setMediaUrls: (v: string[]) => void
  feeRail: ListingFeeRail
  setFeeRail: (v: ListingFeeRail) => void
  /** Non-null only after the Pi fee payment succeeded for this draft. */
  paymentIntentId?: string | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onSubmit: () => void
}) {
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const feeQuote = mode === "edit" ? quoteListingEditFee(feeRail) : quoteListingCreateFee(feeRail)
  const cta = formatListingFeeCta(mode, feeRail)

  const onPickPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setPhotoBusy(true)
    try {
      const next = [...mediaUrls]
      for (const file of Array.from(files).slice(0, 6 - next.length)) {
        if (!file.type.startsWith("image/")) continue
        const uploaded = await uploadDurableMedia(file, {
          fileName: `listing-${Date.now()}-${file.name}`.slice(0, 120),
          category: "images",
        })
        const url = uploaded.ok ? toRelativeMediaFacadeUrl(String(uploaded.url)) : null
        if (url) next.push(url)
      }
      setMediaUrls(next.slice(0, 6))
    } catch {
      /* toast via parent error path if needed */
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div>
        <h2 className="text-[17px] font-bold text-foreground">
          {mode === "edit" ? "Edit listing" : "Sell on Marketplace"}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {mode === "edit"
            ? "Updates cost half the listing fee. Listing fees are non-refundable platform charges."
            : "Priced in ₲ GHC or π Pi. A non-refundable π listing fee is charged when you publish (Pi-only commerce for ecosystem listing)."}
        </p>
      </div>

      <div>
        <span className="text-[12px] font-bold text-muted-foreground">Photos</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {mediaUrls.map((src) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border/60">
              <LazyImage src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove photo"
                onClick={() => setMediaUrls(mediaUrls.filter((u) => u !== src))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {mediaUrls.length < 6 ? (
            <button
              type="button"
              disabled={photoBusy || busy}
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/80 bg-muted/40 text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
            >
              {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
              Add
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onPickPhotos(e.target.files)}
        />
      </div>

      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="What are you selling?"
        />
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Price</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="0.00"
        />
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Listing currency</span>
        <div className="mt-1 flex gap-2">
          {(["GHC", "PI"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`min-h-11 flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                currency === c
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-border/70 bg-card text-muted-foreground"
              }`}
            >
              {c === "GHC" ? "₲ GHC" : "π Pi"}
            </button>
          ))}
        </div>
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {MARKETPLACE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Location (optional)</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value.slice(0, 80))}
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="City or area"
        />
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          rows={4}
          className="mt-1 w-full resize-none rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Condition, pickup, contact notes…"
        />
      </label>

      <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
        <p className="text-[12px] font-bold text-foreground">Listing fee (non-refundable)</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Platform service charge. {mode === "edit" ? "Edit fee is half of the create fee." : "Charged when you publish."}
        </p>
        <div className="mt-2 flex gap-2">
          {(["GHC", "PI"] as const).map((rail) => (
            <button
              key={rail}
              type="button"
              onClick={() => {
                if (paymentIntentId && rail !== "PI") return
                setFeeRail(rail)
              }}
              disabled={Boolean(paymentIntentId && rail !== "PI")}
              className={`min-h-10 flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                feeRail === rail
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-border/70 bg-card text-muted-foreground"
              }`}
            >
              Pay with {rail === "GHC" ? "₲ GHC" : "π Pi"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] font-semibold text-foreground">
          Due now: {feeQuote.label}
        </p>
        {paymentIntentId ? <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">Pi fee payment confirmed for this draft. Retry publishing with Pi; the existing payment will be reused.</p> : null}
      </div>

      {error ? <p className="text-[13px] font-medium text-red-600">{error}</p> : null}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-full border border-border bg-card text-sm font-bold"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || photoBusy}
          onClick={onSubmit}
          className="min-h-11 flex-1 rounded-full bg-[var(--gh-green)] px-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? (mode === "edit" ? "Saving…" : "Publishing…") : cta}
        </button>
      </div>
    </div>
  )
}

function emitMarketplaceEconomyRefresh(reason: string) {
  try {
    window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason } }))
    window.dispatchEvent(new CustomEvent("ghc:wallet-synced", { detail: { reason } }))
  } catch { /* */ }
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
  const [bucket, setBucket] = useState<"browse" | "orders" | "saved" | "sell" | "mine">("browse")
  const [mineListings, setMineListings] = useState<MarketplaceListing[]>([])
  const [mineLoading, setMineLoading] = useState(false)
  const [showCategories, setShowCategories] = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)
  // Sell form (domain.createListing when available — no invented success)
  const [sellTitle, setSellTitle] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [sellCurrency, setSellCurrency] = useState<"GHC" | "PI">("GHC")
  const [sellDesc, setSellDesc] = useState("")
  const [sellCategory, setSellCategory] = useState<string>(MARKETPLACE_CATEGORIES[0] || "Goods")
  const [sellLocation, setSellLocation] = useState("")
  const [sellMedia, setSellMedia] = useState<string[]>([])
  const [sellFeeRail, setSellFeeRail] = useState<ListingFeeRail>("GHC")
  // Preserve identity/intent across retries so a successful fee payment can be reconciled
  // to the same listing instead of charging again after a transient listing-write failure.
  const [sellDraftId, setSellDraftId] = useState<string | null>(null)
  const [sellFeeIntentId, setSellFeeIntentId] = useState<string | null>(null)
  const [sellEditId, setSellEditId] = useState<string | null>(null)
  const [sellBusy, setSellBusy] = useState(false)
  const [sellError, setSellError] = useState<string | null>(null)
  const [savedListings, setSavedListings] = useState<MarketplaceListing[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [durableOrders, setDurableOrders] = useState<MarketplaceOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderBusy, setOrderBusy] = useState<string | null>(null)

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  const loadSavedListings = useCallback(async () => {
    setSavedLoading(true)
    try {
      const remote = await socialFetchMarketplaceSaved(100)
      if (!remote.ok || !remote.durable) { setSavedListings([]); return }
      const mapped = remote.saved.map((row): MarketplaceListing => ({
        id: String(row.listingId || row.listing_id || ""),
        kind: (String(row.kind || "product") as MarketplaceListing["kind"]),
        title: String(row.title || "Listing"), description: String(row.description || ""),
        media: row.metadata && typeof row.metadata === "object" && Array.isArray((row.metadata as Record<string, unknown>).media)
          ? ((row.metadata as Record<string, unknown>).media as unknown[]).map(String) : [],
        category: row.metadata && typeof row.metadata === "object" ? String((row.metadata as Record<string, unknown>).category || "Goods") : "Goods",
        tags: row.metadata && typeof row.metadata === "object" && Array.isArray((row.metadata as Record<string, unknown>).tags)
          ? ((row.metadata as Record<string, unknown>).tags as unknown[]).map(String) : undefined,
        price: Number(row.price) || 0, currency: String(row.currency || "GHC"), condition: "not_applicable",
        location: row.metadata && typeof row.metadata === "object" ? String((row.metadata as Record<string, unknown>).location || "") || undefined : undefined,
        sellerId: String(row.sellerId || row.seller_id || ""), availability: Number(row.availability) || 0,
        status: (String(row.status || "active") as MarketplaceListing["status"]),
        createdAt: Number(row.createdAt) || Date.now(), updatedAt: Number(row.createdAt) || Date.now(),
      })).filter((row) => row.id)
      setSavedListings(mapped)
    } finally { setSavedLoading(false) }
  }, [])

  useEffect(() => {
    if (bucket !== "saved") return
    void loadSavedListings()
    const handler = () => void loadSavedListings()
    window.addEventListener("ghc:marketplace-saves-changed", handler)
    return () => window.removeEventListener("ghc:marketplace-saves-changed", handler)
  }, [bucket, loadSavedListings])

  const loadMineListings = useCallback(async () => {
    setMineLoading(true)
    try {
      const { socialFetchMarketplaceListings } = await import("@/lib/social/client")
      const remote = await socialFetchMarketplaceListings({ scope: "mine", limit: 100 })
      if (!remote.ok) {
        setMineListings([])
        return
      }
      const mapped = remote.listings
        .map((row): MarketplaceListing => ({
          id: String(row.id || ""),
          kind: (String(row.kind || "product") as MarketplaceListing["kind"]) || "product",
          title: String(row.title || "Listing"),
          description: String(row.description || ""),
          media: Array.isArray(row.media) ? row.media.map(String) : [],
          category: String(row.category || "Goods"),
          tags: Array.isArray(row.tags) ? row.tags.map(String) : undefined,
          price: Number(row.price) || 0,
          currency: String(row.currency || "GHC"),
          condition: (String(row.condition || "new") as MarketplaceListing["condition"]) || "new",
          location: row.location ? String(row.location) : undefined,
          sellerId: String(row.sellerId || row.seller_id || ""),
          availability: Number(row.availability) || 1,
          status: (String(row.status || "active") as MarketplaceListing["status"]) || "active",
          createdAt: Number(row.createdAt || row.created_at || Date.now()) || Date.now(),
          updatedAt: Number(row.updatedAt || row.updated_at || Date.now()) || Date.now(),
        }))
        .filter((l) => l.id)
      setMineListings(mapped)
    } finally {
      setMineLoading(false)
    }
  }, [])

  useEffect(() => {
    if (bucket !== "mine") return
    void loadMineListings()
  }, [bucket, loadMineListings])

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

  const loadDurableOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await fetch("/api/marketplace/orders", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data.orders)) { setDurableOrders([]); return }
      setDurableOrders(data.orders.map((o: Record<string, unknown>) => ({
        id: String(o.id || ""), listingId: String(o.listingId || ""), buyerId: String(o.buyerId || ""), sellerId: String(o.sellerId || ""),
        quantity: Number(o.quantity) || 1, unitPrice: Number(o.unitPrice) || 0, currency: String(o.currency || "GHC"),
        status: String(o.status || "created") as MarketplaceOrder["status"], createdAt: Number(o.createdAt) || Date.now(), updatedAt: Number(o.updatedAt) || Date.now(),
        confirmedAt: Number(o.confirmedAt) || undefined, fulfilledAt: Number(o.fulfilledAt) || undefined, completedAt: Number(o.completedAt) || undefined, cancelledAt: Number(o.cancelledAt) || undefined,
        paymentStatus: String(o.paymentStatus || "none") as MarketplaceOrder["paymentStatus"], paymentMethod: String(o.paymentMethod || "none") as MarketplaceOrder["paymentMethod"], serverOrderId: String(o.id || ""),
      })))
    } catch { setDurableOrders([]) } finally { setOrdersLoading(false) }
  }, [])

  useEffect(() => {
    if (bucket !== "orders") return
    void loadDurableOrders()
    const handler = () => void loadDurableOrders()
    window.addEventListener("ghc:marketplace-order-changed", handler)
    return () => window.removeEventListener("ghc:marketplace-order-changed", handler)
  }, [bucket, loadDurableOrders])

  const openOrderConversation = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/marketplace/orders/${encodeURIComponent(orderId)}/conversation`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.conversation?.id) return
      window.dispatchEvent(new CustomEvent("ghc:open-conversation", { detail: { conversationId: data.conversation.id, kind: "direct", contextType: "marketplace_order", orderId } }))
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: { tab: "messages" } }))
    } catch {
      /* Keep marketplace usable if messaging is temporarily unavailable. */
    }
  }, [])

  const runOrderAction = useCallback(async (orderId: string, action: string) => {
    if (orderBusy) return
    setOrderBusy(orderId + ":" + action)
    try {
      const res = await fetch(`/api/marketplace/orders/${encodeURIComponent(orderId)}/commerce`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(String(data.error || "Order action failed"))
      await loadDurableOrders()
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "Order updated", type: "success" } }))
    } catch (e) {
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: e instanceof Error ? e.message : "Order action failed", type: "error" } }))
    } finally { setOrderBusy(null) }
  }, [loadDurableOrders, orderBusy])

  const domain = getMarketplaceDomain()

  // Phase 9: merge durable public listings into local domain store
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { socialFetchMarketplaceListings } = await import("@/lib/social/client")
        const remote = await socialFetchMarketplaceListings({ scope: "public", limit: 50 })
        if (cancelled || !remote.ok || !remote.listings.length) return
        const KEY = "ghc_marketplace_listings_v1"
        let local: MarketplaceListing[] = []
        try {
          const raw = window.localStorage.getItem(KEY)
          local = raw ? (JSON.parse(raw) as MarketplaceListing[]) : []
          if (!Array.isArray(local)) local = []
        } catch {
          local = []
        }
        const byId = new Map<string, MarketplaceListing>()
        for (const l of local) {
          if (l?.id) byId.set(l.id, l)
        }
        for (const row of remote.listings) {
          const id = String(row.id || "")
          if (!id) continue
          const mapped: MarketplaceListing = {
            id,
            kind: (String(row.kind || "product") as MarketplaceListing["kind"]) || "product",
            title: String(row.title || "Listing"),
            description: String(row.description || ""),
            media: Array.isArray(row.media) ? row.media.map(String) : [],
            category: String(row.category || "Goods"),
            tags: Array.isArray(row.tags) ? row.tags.map(String) : undefined,
            price: Number(row.price) || 0,
            currency: String(row.currency || "GHC"),
            condition: (String(row.condition || "new") as MarketplaceListing["condition"]) || "new",
            location: row.location ? String(row.location) : undefined,
            shippingInfo: row.shippingInfo ? String(row.shippingInfo) : undefined,
            sellerId: String(row.sellerId || row.seller_id || ""),
            availability: Number(row.availability) || 1,
            status: (String(row.status || "active") as MarketplaceListing["status"]) || "active",
            createdAt: Number(row.createdAt || row.created_at || Date.now()) || Date.now(),
            updatedAt: Number(row.updatedAt || row.updated_at || Date.now()) || Date.now(),
          }
          byId.set(id, mapped)
        }
        const merged = Array.from(byId.values()).sort(
          (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
        )
        try {
          window.localStorage.setItem(KEY, JSON.stringify(merged.slice(0, 500)))
        } catch {
          /* */
        }
        setTick((n) => n + 1)
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
    if (durableOrders.length) return durableOrders
    if (!domain?.getOrders) return [] as MarketplaceOrder[]
    try { return domain.getOrders?.() || [] } catch { return [] }
  }, [domain, tick, durableOrders])

  const [remoteSelected, setRemoteSelected] = useState<MarketplaceListing | null>(null)

  useEffect(() => {
    if (!selectedId) {
      setRemoteSelected(null)
      return
    }
    const local =
      (domain?.getListing ? domain.getListing(selectedId) : null) ||
      listings.find((l) => l.id === selectedId) ||
      null
    if (local) {
      setRemoteSelected(local)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { socialFetchMarketplaceListing } = await import("@/lib/social/client")
        const remote = await socialFetchMarketplaceListing(selectedId)
        if (cancelled || !remote.ok || !remote.listing) return
        const row = remote.listing
        const mapped: MarketplaceListing = {
          id: String(row.id || selectedId),
          kind: (String(row.kind || "product") as MarketplaceListing["kind"]) || "product",
          title: String(row.title || "Listing"),
          description: String(row.description || ""),
          media: Array.isArray(row.media) ? row.media.map(String) : [],
          category: String(row.category || "Goods"),
          tags: Array.isArray(row.tags) ? row.tags.map(String) : undefined,
          price: Number(row.price) || 0,
          currency: String(row.currency || "GHC"),
          condition: (String(row.condition || "new") as MarketplaceListing["condition"]) || "new",
          location: row.location ? String(row.location) : undefined,
          sellerId: String(row.sellerId || row.seller_id || ""),
          availability: Number(row.availability) || 1,
          status: (String(row.status || "active") as MarketplaceListing["status"]) || "active",
          createdAt: Number(row.createdAt || Date.now()) || Date.now(),
          updatedAt: Number(row.updatedAt || Date.now()) || Date.now(),
        }
        setRemoteSelected(mapped)
      } catch {
        /* */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, domain, listings])

  const selected = useMemo(() => {
    if (!selectedId) return null
    if (remoteSelected && remoteSelected.id === selectedId) return remoteSelected
    if (domain?.getListing) {
      const d = domain.getListing(selectedId)
      if (d) return d
    }
    return listings.find((l) => l.id === selectedId) || null
  }, [selectedId, domain, listings, remoteSelected])

  useEffect(() => {
    const onOpenMarket = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail || typeof detail !== "object") return
      const bucketNext = String((detail as { bucket?: string }).bucket || "").toLowerCase()
      if (bucketNext === "sell" || bucketNext === "mine" || bucketNext === "orders" || bucketNext === "saved" || bucketNext === "browse") {
        setBucket(bucketNext as typeof bucket)
      }
      const lid = String((detail as { listingId?: string }).listingId || "").trim()
      if (lid) setSelectedId(lid)
    }
    window.addEventListener("ghc:open-marketplace", onOpenMarket)
    return () => window.removeEventListener("ghc:open-marketplace", onOpenMarket)
  }, [])

  if (selected) {
    return (
      <ListingDetail
        listing={selected}
        onBack={() => setSelectedId(null)}
        onOpenListing={(id) => setSelectedId(id)}
        onSearchBrowse={(q) => {
          setSelectedId(null)
          setBucket("browse")
          setQuery(q)
          setShowCategories(true)
          requestAnimationFrame(() => searchRef.current?.focus())
        }}
        onEditListing={(listing) => {
          setSellEditId(listing.id)
          setSellTitle(listing.title || "")
          setSellPrice(String(listing.price ?? ""))
          setSellCurrency((listing.currency || "GHC").toUpperCase() === "PI" ? "PI" : "GHC")
          setSellDesc(listing.description || "")
          setSellCategory(listing.category || MARKETPLACE_CATEGORIES[0] || "Goods")
          setSellLocation(listing.location || "")
          setSellMedia(Array.isArray(listing.media) ? listing.media.filter(Boolean).map(String) : [])
          setSelectedId(null)
          setBucket("sell")
        }}
        onDelist={async (listing) => {
          try {
            const { socialCreateMarketplaceListing } = await import("@/lib/social/client")
            const remote = await socialCreateMarketplaceListing({
              id: listing.id,
              title: listing.title,
              description: listing.description,
              price: listing.price,
              currency: listing.currency,
              status: "paused",
              kind: listing.kind || "product",
              availability: listing.availability,
              media: listing.media,
              location: listing.location,
              category: listing.category,
            })
            if (domain?.updateListing) {
              await domain.updateListing(listing.id, { status: "paused" })
            }
            if (!remote.ok) {
              window.dispatchEvent(
                new CustomEvent("ghc:toast", {
                  detail: { message: remote.error || "Could not delist", type: "error" },
                }),
              )
              return
            }
            window.dispatchEvent(
              new CustomEvent("ghc:toast", {
                detail: { message: "Listing delisted (paused). Fees are non-refundable.", type: "info" },
              }),
            )
            setSelectedId(null)
            refresh()
            void loadMineListings()
          } catch (e) {
            window.dispatchEvent(
              new CustomEvent("ghc:toast", {
                detail: {
                  message: e instanceof Error ? e.message : "Could not delist",
                  type: "error",
                },
              }),
            )
          }
        }}
        onRemoveListing={async (listing) => {
          try {
            const { socialCreateMarketplaceListing } = await import("@/lib/social/client")
            const remote = await socialCreateMarketplaceListing({
              id: listing.id,
              title: listing.title,
              description: listing.description,
              price: listing.price,
              currency: listing.currency,
              status: "removed",
              kind: listing.kind || "product",
              availability: listing.availability,
              media: listing.media,
              location: listing.location,
              category: listing.category,
            })
            if (domain?.updateListing) {
              await domain.updateListing(listing.id, { status: "removed" })
            }
            if (!remote.ok) {
              window.dispatchEvent(
                new CustomEvent("ghc:toast", {
                  detail: { message: remote.error || "Could not delete listing", type: "error" },
                }),
              )
              return
            }
            window.dispatchEvent(
              new CustomEvent("ghc:toast", {
                detail: { message: "Listing removed. Listing fees are non-refundable.", type: "info" },
              }),
            )
            setSelectedId(null)
            refresh()
            void loadMineListings()
          } catch (e) {
            window.dispatchEvent(
              new CustomEvent("ghc:toast", {
                detail: {
                  message: e instanceof Error ? e.message : "Could not delete listing",
                  type: "error",
                },
              }),
            )
          }
        }}
      />
    )
  }

  return (
    <div className="gh-marketplace-shell gh-world-marketplace flex h-full min-h-0 flex-col bg-background text-foreground" role="region" aria-label="GreenHaven marketplace">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border/50 px-2.5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
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

        {/* FB-style action chips */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none" role="toolbar" aria-label="Marketplace tools">
          {[
            { id: "browse" as const, label: "Browse", icon: Store },
            { id: "sell" as const, label: "Sell", icon: Plus },
            { id: "mine" as const, label: "My listings", icon: TagIcon },
            { id: "orders" as const, label: "Orders", icon: Package },
            { id: "saved" as const, label: "Saved", icon: Bookmark },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setBucket(chip.id)
                if (chip.id === "browse") setShowCategories(true)
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
                bucket === chip.id
                  ? "bg-[var(--gh-green)] text-white shadow-sm"
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              <chip.icon size={14} aria-hidden />
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setBucket("browse")
              setShowCategories((v) => !v)
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
              showCategories && bucket === "browse"
                ? "bg-card text-foreground ring-1 ring-border shadow-sm"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            <Tag size={14} aria-hidden />
            Categories
          </button>
          <button
            type="button"
            onClick={() => {
              setBucket("browse")
              setSearchFocused(true)
              requestAnimationFrame(() => searchRef.current?.focus())
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-[12px] font-bold text-foreground hover:bg-muted/80"
          >
            <Search size={14} aria-hidden />
            Search
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
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search listings…"
                className={`gh-standard-search h-11 w-full border border-border/70 pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 ${
                  searchFocused ? "ring-2 ring-primary/20" : ""
                }`}
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

            {showCategories ? (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" role="listbox" aria-label="Categories">
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
            ) : null}
          </>
        ) : null}
      </header>

      <div className="gh-marketplace-content min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-3">
        {bucket === "mine" ? (
          <div className="p-1">
            <div className="mx-auto w-full max-w-[var(--gh-content-max,42rem)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">My listings</h2>
                  <p className="text-xs text-muted-foreground">
                    Server-authoritative seller catalog. Edit, delist, or delete from a listing page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSellEditId(null)
                    setSellMedia([])
                    setBucket("sell")
                  }}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white"
                >
                  <Plus size={14} aria-hidden />
                  New
                </button>
              </div>
              {mineLoading ? (
                <div className="rounded-2xl border border-border/50 p-6 text-center text-sm text-muted-foreground">
                  Loading your listings…
                </div>
              ) : mineListings.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {mineListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onOpen={(id) => setSelectedId(id)} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No listings yet"
                  description="Publish a product or service priced in ₲ or π. Listing fees are non-refundable."
                  action={{ label: "Sell something", onClick: () => setBucket("sell") }}
                />
              )}
            </div>
          </div>
        ) : null}

        {bucket === "saved" ? (
        <div className="p-1">
          <div className="mx-auto w-full max-w-[var(--gh-content-max,42rem)]">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="text-base font-bold">Saved listings</h2><p className="text-xs text-muted-foreground">Your marketplace shortlist stays synced to your account.</p></div>
              <Bookmark size={18} className="text-emerald-700" aria-hidden />
            </div>
            {savedLoading ? <div className="rounded-2xl border border-border/50 p-6 text-center text-sm text-muted-foreground">Loading saved listings…</div>
              : savedListings.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{savedListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={(id) => setSelectedId(id)} />)}</div>
              : <EmptyState title="Nothing saved yet" description="Save a listing from its detail page and it will appear here." action={{ label: "Browse marketplace", onClick: () => setBucket("browse") }} />}
          </div>
        </div>
      ) : null}

      {bucket === "sell" ? (
          <SellListingForm
            mode={sellEditId ? "edit" : "create"}
            title={sellTitle}
            setTitle={setSellTitle}
            price={sellPrice}
            setPrice={setSellPrice}
            currency={sellCurrency}
            setCurrency={setSellCurrency}
            description={sellDesc}
            setDescription={setSellDesc}
            category={sellCategory}
            setCategory={setSellCategory}
            location={sellLocation}
            setLocation={setSellLocation}
            mediaUrls={sellMedia}
            setMediaUrls={setSellMedia}
            feeRail={sellFeeRail}
            setFeeRail={setSellFeeRail}
            paymentIntentId={sellFeeIntentId}
            busy={sellBusy}
            error={sellError}
            onCancel={() => {
              setSellEditId(null)
              setSellMedia([])
              setBucket("browse")
            }}
            onSubmit={async () => {
              setSellError(null)
              const priceNum = Number(sellPrice)
              if (!sellTitle.trim()) {
                setSellError("Add a title")
                return
              }
              if (!Number.isFinite(priceNum) || priceNum < 0) {
                setSellError("Enter a valid price")
                return
              }
              setSellBusy(true)
              try {
                if (sellEditId) {
                  const { socialCreateMarketplaceListing } = await import("@/lib/social/client")
                  const remote = await socialCreateMarketplaceListing({
                    id: sellEditId,
                    title: sellTitle.trim(),
                    description: sellDesc.trim() || sellTitle.trim(),
                    price: priceNum,
                    currency: sellCurrency,
                    status: "active",
                    kind: "product",
                    availability: 1,
                    media: sellMedia.slice(0, 6),
                    location: sellLocation.trim() || undefined,
                    category: sellCategory,
                  })
                  if (!remote.ok) {
                    setSellError(remote.message || remote.error || "Could not update listing")
                    return
                  }
                  if (domain?.updateListing) {
                    await domain.updateListing(sellEditId, {
                      title: sellTitle.trim(),
                      description: sellDesc.trim() || sellTitle.trim(),
                      category: sellCategory,
                      price: priceNum,
                      currency: sellCurrency,
                      location: sellLocation.trim() || undefined,
                      media: sellMedia.slice(0, 6),
                      status: "active",
                    })
                  }
                  try {
                    window.dispatchEvent(
                      new CustomEvent("ghc:toast", {
                        detail: {
                          message: `Listing updated · edit fee ${quoteListingEditFee(sellFeeRail).label} (non-refundable)`,
                          type: "success",
                        },
                      }),
                    )
                  } catch { /* */ }
                  emitMarketplaceEconomyRefresh("marketplace-listing-edit")
                  const editedId = sellEditId
                  setSellEditId(null)
                  setSellTitle("")
                  setSellPrice("")
                  setSellDesc("")
                  setSellLocation("")
                  setSellMedia([])
                  setBucket("browse")
                  setSelectedId(editedId)
                  refresh()
                  void loadMineListings()
                  return
                }
                // Prefer durable server create with selected fee rail (never invent success).
                let res: { ok: boolean; error?: string; message?: string; data?: { listing?: { id?: string } }; listing?: { id?: string } }
                let serverPublished = false
                try {
                  const { socialCreateMarketplaceListing } = await import("@/lib/social/client")
                  // Stable listing identity binds any Pi listing-fee intent to exactly this listing.
                  const listingId = sellDraftId || `lst_${crypto.randomUUID()}`
                  if (!sellDraftId) setSellDraftId(listingId)
                  let listingFeePaymentId: string | undefined = sellFeeRail === "PI" ? (sellFeeIntentId || undefined) : undefined
                  if (sellFeeRail === "PI" && !listingFeePaymentId) {
                    const quoteResponse = await fetch(`/api/marketplace/listing-fee?mode=create&price=${encodeURIComponent(String(priceNum))}&currency=${encodeURIComponent(sellCurrency)}&kind=product&feeCurrency=PI`, {
                      cache: "no-store",
                      headers: IdentityService.getAuthHeaders(),
                    })
                    const quoteData = await quoteResponse.json().catch(() => ({})) as { ok?: boolean; fee?: { amount?: number; currency?: string; requiresSettlement?: boolean } }
                    const feeAmount = Number(quoteData.fee?.amount)
                    if (!quoteResponse.ok || !quoteData.ok || !Number.isFinite(feeAmount) || feeAmount <= 0 || String(quoteData.fee?.currency).toUpperCase() !== "PI") {
                      setSellError("Pi listing fee is not configured correctly on the server. No payment was started.")
                      return
                    }
                    const referenceId = `marketplace_listing_fee_${listingId}`
                    const intentResponse = await fetch("/api/payments/intents", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json", ...IdentityService.getAuthHeaders() },
                      body: JSON.stringify({
                        purpose: "marketplace",
                        amount: feeAmount,
                        currency: "PI",
                        referenceId,
                        idempotencyKey: referenceId,
                        metadata: { kind: "listing_fee", feeKind: "listing_fee", listingId, marketplaceListingId: listingId },
                      }),
                    })
                    const intentData = await intentResponse.json().catch(() => ({})) as { ok?: boolean; intent?: { id?: string }; error?: string; message?: string }
                    const intentId = String(intentData.intent?.id || "")
                    if (!intentResponse.ok || !intentData.ok || !intentId) {
                      setSellError(intentData.message || intentData.error || "Could not prepare a secure Pi listing-fee payment.")
                      return
                    }
                    const payment = await startUserToAppPayment({
                      amount: feeAmount,
                      memo: `GreenHaven marketplace listing fee · ${sellTitle.trim().slice(0, 80)}`,
                      intentId,
                      authHeaders: IdentityService.getAuthHeaders(),
                      metadata: { purpose: "marketplace", kind: "listing_fee", listingId, intentId, referenceId },
                    })
                    if (!payment.ok) {
                      setSellError(payment.cancelled ? "Pi payment was cancelled. Your listing was not published." : payment.error || "Pi listing-fee payment did not complete. Your listing was not published.")
                      return
                    }
                    listingFeePaymentId = intentId
                    setSellFeeIntentId(intentId)
                  }
                  const durable = await socialCreateMarketplaceListing({
                    id: listingId,
                    title: sellTitle.trim(),
                    description: sellDesc.trim() || sellTitle.trim(),
                    category: sellCategory,
                    price: priceNum,
                    currency: sellCurrency,
                    location: sellLocation.trim() || undefined,
                    media: sellMedia.slice(0, 6),
                    status: "active",
                    kind: "product",
                    feeCurrency: sellFeeRail,
                    listingFeePaymentId,
                  })
                  if (!durable.ok) {
                    const err = String(durable.error || "")
                    const msg = String(durable.message || "")
                    if (sellFeeRail === "PI") {
                      setSellError(
                        msg.includes("GHC")
                          ? "Pi listing fee requires a completed Pi payment. Tap Publish after paying with π, or switch to Pay with GHC."
                          : msg || err || "Pi listing fee could not be completed. Complete GH Pay for the fee, or use GHC.",
                      )
                    } else {
                      setSellError(
                        err === "INSUFFICIENT_BALANCE" || msg.toLowerCase().includes("insufficient")
                          ? "Not enough available GHC for the listing fee. Claim matured rewards or buy a GHC pack, then retry."
                          : msg || err || "Listing fee could not be settled from available GHC.",
                      )
                    }
                    return
                  }
                  res = {
                    ok: true,
                    data: { listing: durable.listing as { id?: string } },
                    listing: durable.listing as { id?: string },
                  }
                  serverPublished = true
                  emitMarketplaceEconomyRefresh("marketplace-listing-create")
                } catch (error) {
                  // Preserve an offline draft queue, but never call it published or charge a fee locally.
                  if (typeof navigator !== "undefined" && navigator.onLine === false) {
                    res = { ok: true }
                  } else {
                    setSellError(error instanceof Error ? error.message : "Could not reach the marketplace server. Check your Orders/Payments before retrying.")
                    return
                  }
                }
                let id = res.data?.listing?.id || sellDraftId || undefined
                // Server-first durable marketplace — no silent local-only public listing
                const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
                if (!online) {
                  try {
                    const { offlineQueue } = await import("@/lib/network-resilience")
                    offlineQueue.addAction({
                      type: "create_listing",
                      payload: {
                        id: id || undefined,
                        title: sellTitle.trim(),
                        description: sellDesc.trim() || sellTitle.trim(),
                        price: priceNum,
                        currency: sellCurrency,
                        status: "active",
                        kind: "product",
                        availability: 1,
                        location: sellLocation.trim() || undefined,
                        category: sellCategory,
                        media: sellMedia.slice(0, 6),
                      },
                      maxRetries: 3,
                    })
                    // Keep local draft listing for this device; public publish waits for flush
                    setSellTitle("")
                    setSellPrice("")
                    setSellDesc("")
                    setSellLocation("")
                    setSellMedia([])
                    setSellDraftId(null)
                    setSellFeeIntentId(null)
                    setBucket("browse")
                    refresh()
                    setSellError(null)
                    // Signal via custom event for global toast hosts
                    try {
                      window.dispatchEvent(
                        new CustomEvent("ghc:toast", {
                          detail: {
                            message:
                              "Listing saved offline — will publish when you're back online",
                            type: "info",
                          },
                        })
                      )
                    } catch {
                      /* */
                    }
                  } catch {
                    setSellError("You're offline — could not queue listing")
                  }
                  return
                }
                if (online && !serverPublished) {
                  try {
                    const { socialCreateMarketplaceListing } = await import("@/lib/social/client")
                    const remote = await socialCreateMarketplaceListing({
                      id: id || undefined,
                      title: sellTitle.trim(),
                      description: sellDesc.trim() || sellTitle.trim(),
                      price: priceNum,
                      currency: sellCurrency,
                      status: "active",
                      kind: "product",
                      availability: 1,
                      media: sellMedia.slice(0, 6),
                      location: sellLocation.trim() || undefined,
                      category: sellCategory,
                      feeCurrency: sellFeeRail,
                    })
                    if (!remote.ok || remote.durable === false) {
                      setSellError(
                        remote.message ||
                          remote.error ||
                          "Could not publish listing to the server. Try again when online."
                      )
                      return
                    }
                    if (remote.listing?.id) {
                      id = String(remote.listing.id)
                      try {
                        const KEY = "ghc_marketplace_listings_v1"
                        const raw = window.localStorage.getItem(KEY)
                        const list = raw ? (JSON.parse(raw) as MarketplaceListing[]) : []
                        if (Array.isArray(list) && res.data?.listing?.id) {
                          const localId = String(res.data.listing.id)
                          const next = list.map((l) =>
                            l.id === localId
                              ? {
                                  ...l,
                                  id,
                                  sellerId: String(
                                    (remote.listing as { sellerId?: string }).sellerId ||
                                      l.sellerId
                                  ),
                                }
                              : l
                          )
                          window.localStorage.setItem(KEY, JSON.stringify(next))
                        }
                      } catch {
                        /* */
                      }
                    }
                  } catch {
                    setSellError("Could not reach the server to publish this listing")
                    return
                  }
                }
                setSellTitle("")
                setSellPrice("")
                setSellDesc("")
                setSellLocation("")
                setSellMedia([])
                setSellEditId(null)
                setSellDraftId(null)
                setSellFeeIntentId(null)
                setBucket("browse")
                refresh()
                if (id) setSelectedId(id)
                try {
                  window.dispatchEvent(
                    new CustomEvent("ghc:toast", {
                      detail: {
                        message: `Listing published · fee ${quoteListingCreateFee(sellFeeRail).label} (non-refundable)`,
                        type: "success",
                      },
                    }),
                  )
                } catch { /* */ }
              } catch {
                setSellError("Could not create listing")
              } finally {
                setSellBusy(false)
              }
            }}
          />
        ) : bucket === "orders" ? (
          ordersLoading && orders.length === 0 ? (
            <div className="rounded-2xl border border-border/50 p-6 text-center text-sm text-muted-foreground">Loading durable orders…</div>
          ) : orders.length === 0 ? (
            <EmptyState variant="transactions" title="No orders yet" description="Purchases and sales appear here from the durable Marketplace order authority." icon={Package} />
          ) : (
            <ul className="space-y-2.5">
              {orders.map((o) => {
                const viewerId = IdentityService.getCurrentUserId() || ""
                const isSeller = viewerId === o.sellerId
                const status = String(o.status || "created")
                const busy = Boolean(orderBusy)
                return (
                  <li key={o.id} className="rounded-[1.5rem] border border-border/50 bg-card p-4 shadow-[var(--gh-card-shadow)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">Marketplace order</p><p className="mt-0.5 text-[12px] text-muted-foreground">{o.quantity} × {o.unitPrice} {o.currency} · {isSeller ? "Seller" : "Buyer"}</p></div>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{status.replace(/_/g," ")}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => void openOrderConversation(o.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold">
                        <MessageCircle className="h-3.5 w-3.5" /> Chat
                      </button>
                      {!isSeller && ["created","payment_pending"].includes(status) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              try {
                                const { socialPayMarketplaceOrder } = await import("@/lib/social/client")
                                const cur = String(o.currency || "GHC").toUpperCase()
                                if (cur === "PI") {
                                  openPayForListing(
                                    { listingId: o.listingId, orderId: o.id, title: o.listingId },
                                    "pi",
                                  )
                                  return
                                }
                                const paid = await socialPayMarketplaceOrder(o.id, "ghc")
                                if (!paid.ok) throw new Error(paid.error || "Payment failed")
                                emitMarketplaceEconomyRefresh("marketplace-order-pay-now")
                                await loadDurableOrders()
                                window.dispatchEvent(
                                  new CustomEvent("ghc:toast", {
                                    detail: { message: "Order paid with GHC", type: "success" },
                                  }),
                                )
                              } catch (e) {
                                window.dispatchEvent(
                                  new CustomEvent("ghc:toast", {
                                    detail: {
                                      message: e instanceof Error ? e.message : "Pay failed",
                                      type: "error",
                                    },
                                  }),
                                )
                              }
                            })()
                          }}
                          className="min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white"
                        >
                          Pay now
                        </button>
                      ) : null}
                      {!isSeller && ["created","payment_pending"].includes(status) ? <button type="button" disabled={busy} onClick={() => void runOrderAction(o.id,"cancel_unpaid")} className="min-h-9 rounded-full border border-border px-3 text-xs font-bold">Cancel</button> : null}
                      {isSeller && status === "confirmed" ? <button type="button" disabled={busy} onClick={() => void runOrderAction(o.id,"seller_fulfill")} className="min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white">Start fulfillment</button> : null}
                      {isSeller && status === "fulfilling" ? <button type="button" disabled={busy} onClick={() => void runOrderAction(o.id,"seller_mark_delivered")} className="min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white">Mark delivered</button> : null}
                      {!isSeller && ["confirmed","fulfilling"].includes(status) ? <button type="button" disabled={busy} onClick={() => void runOrderAction(o.id,"buyer_confirm")} className="min-h-9 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white">Confirm received</button> : null}
                      {!['completed','cancelled','disputed','refunded'].includes(status) && o.paymentStatus === "verified" ? <button type="button" disabled={busy} onClick={() => void runOrderAction(o.id,"dispute")} className="min-h-9 rounded-full border border-amber-500/50 px-3 text-xs font-bold text-amber-700 dark:text-amber-300">Open dispute</button> : null}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Updated {new Date(o.updatedAt || o.createdAt).toLocaleString()}</p>
                  </li>
                )
              })}
            </ul>
          )
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center px-2 pt-6">
            <EmptyState
              variant="search"
              title={query || category ? "No matching listings" : "No listings yet"}
              description={
                query || category
                  ? "Try another search or category. Only real listings from sellers appear here."
                  : "Seller listings will appear here when they are published and available."
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
          <>
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-foreground">Today&apos;s picks</h2>
                <p className="text-[11px] text-muted-foreground">
                  {listings.length} listing{listings.length === 1 ? "" : "s"}
                  {category ? ` · ${category}` : ""}
                  {query.trim() ? ` · “${query.trim()}”` : ""}
                </p>
              </div>
              <button type="button" onClick={refresh} className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300">
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3 min-[960px]:grid-cols-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} onOpen={setSelectedId} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
