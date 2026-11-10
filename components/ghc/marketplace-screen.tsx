"use client"

import { DurableImage } from "./durable-image"
import { isPiOnlyCommerceClient } from "@/lib/client/pi-only-commerce"
import { useRegionalContext } from "@/contexts/regional-context"
import { getProductMessage } from "@/lib/i18n/product"
import { getWorkflowMessage } from "@/lib/i18n/workflows"

import { formatPrice, listedWhen, relatedSearchTokens, relatedListingsFor, suggestedCommunitiesFor } from "@/lib/marketplace/discovery-presentation"
import { parseProductOptionsText, productOptionsToText } from "@/lib/marketplace/product-options"
import { parseProductVariantsText, productVariantsToText } from "@/lib/marketplace/product-variants"
import { mapMarketplaceListingRecord, mapMarketplaceOrderRecord, mapSavedMarketplaceListingRecord } from "@/lib/marketplace/record-mappers"

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
  ShoppingCart,
  Minus,
  ShieldCheck,
  Truck,
  Zap,
  BarChart3,
  CheckCircle2,
  Clock3,
} from "lucide-react"
import { FilterSummary } from "./filtering/filter-summary"
import { FilterResultState } from "./filtering/filter-result-state"
import { getMarketplaceDomain } from "@/lib/domains/compat"
import {
  MARKETPLACE_CATEGORIES,
  type ListingKind,
  type MarketplaceListing,
  type MarketplaceOrder,
} from "@/lib/domains/marketplace-domain"
import { messageListingSeller, openPayForListing } from "@/lib/marketplace/commerce-actions"
import {
  ORDER_LIFECYCLE_STEPS,
  orderLifecycleIndex,
  orderStatusLabel,
  orderNextActionHint,
  sortMarketplaceListings,
  type BrowseSort,
} from "@/lib/marketplace/order-lifecycle"
import { useSectionRefresh } from "@/hooks/use-section-refresh"
import { useAccountFilterState } from "@/hooks/use-account-filter-state"
import { matchesFilterCurrencyRange } from "@/lib/filtering/filter-contract"
import { emitSectionRefresh } from "@/lib/client/section-refresh"
import {
  DELIVERY_MODE_LABELS,
  encodeShippingInfo,
  formatDeliveryLine,
  formatRating,
  parseDeliveryMode,
  type DeliveryMode,
  type ListingReportReason,
} from "@/lib/marketplace/trust"
import { openCommunity } from "@/lib/navigation/navigate"
import { EmptyState } from "./empty-state"
import { LoadingState } from "@/components/ghc/experience-state"
import { WorkflowFeedback } from "@/components/ghc/workflow-feedback"
import { workflowFeedback } from "@/lib/workflow-experience"
import { SurfaceIntro } from "./ui/product-surface"
import { LazyImage } from "./lazy-image"
import { downloadMedia } from "@/lib/media/download-media"
import { socialFetchMarketplaceSaved, socialToggleMarketplaceSaved } from "@/lib/social/client"
import { IdentityService } from "@/lib/identity/identity-service"
import { isOwnedByCurrentUser } from "@/lib/identity/identity-match"
import { startUserToAppPayment } from "@/lib/pi-u2a-payment"
import { uploadDurableMedia } from "@/lib/media/upload-client"
import { toRelativeMediaFacadeUrl } from "@/lib/media/resolve-display-url"
import {
  addMarketplaceCartItem,
  clearMarketplaceCart,
  getMarketplaceCart,
  removeMarketplaceCartItem,
  removeMarketplaceCartItemsByIds,
  removeMarketplaceCartItemsBySeller,
  updateMarketplaceCartQuantity,
  type MarketplaceCartItem,
} from "@/lib/marketplace/cart"
import { humanizeClientErrorCode, toClientSafeErrorMessage } from "@/lib/client/safe-api-error"
import {
  formatListingFeeCta,
  quoteListingCreateFee,
  quoteListingEditFee,
  type ListingFeeRail,
} from "@/lib/marketplace/listing-fee-client"
import { getMarketplaceOrderCurrency, type MarketplaceCurrency } from "@/lib/marketplace/checkout-contract"

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
  const effectiveStatus = listing.kind === "product" && listing.status === "active" && listing.availability <= 0
    ? "sold_out"
    : listing.status
  const chip = statusChip(effectiveStatus)
  const media = listing.media?.[0]
  // Refresh is owned by MarketplaceScreen (single soft-refresh gate) — not per card.

  return (
    <button
      type="button"
      onClick={() => onOpen(listing.id)}
      className="gh-card-interactive group flex w-full flex-col overflow-hidden rounded-[1.25rem] border border-border/50 bg-card text-left shadow-[var(--gh-card-shadow)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/80 hover:shadow-[var(--gh-card-shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.99] motion-reduce:transform-none dark:hover:border-emerald-900"
      aria-label={`${listing.title}, ${formatPrice(listing)}`}
    >
      <div className="relative aspect-[4/3] w-full bg-muted/50">
        {media ? (
          <LazyImage
            src={media}
            alt={listing.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none"
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
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-foreground">
          {listing.title}
        </p>
        <p className="text-[15px] font-extrabold tracking-tight text-foreground">
          {formatPrice(listing)}
        </p>
        {listing.shippingInfo || listing.location ? (
          <p className="line-clamp-1 text-[10px] font-medium text-muted-foreground">
            {formatDeliveryLine(listing.shippingInfo, listing.location)}
          </p>
        ) : null}
        {listing.location ? (
          <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] text-muted-foreground">
            <MapPin size={11} className="shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{listing.location}</span>
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {kindLabel(listing.kind)}
          </span>
          {listing.kind === "product" && listing.condition !== "not_applicable" ? (
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {listing.condition.replace(/_/g, " ")}
            </span>
          ) : null}
          {listing.availability > 0 && listing.availability <= 3 ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
              {listing.availability} left
            </span>
          ) : null}
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
  const idempotencyKeyRef = useRef<string | null>(null)
  const listingCur = (listing.currency || "GHC").toUpperCase()
  // Orders are settled in the listing's server-authoritative currency. Do not offer
  // a second rail unless a verified conversion/dual-currency quote exists.
  const requiredRail: "ghc" | "pi" = listingCur === "PI" ? "pi" : "ghc"
  const [payRail, setPayRail] = useState<"ghc" | "pi">(requiredRail)
  const isOwn = isOwnedByCurrentUser(listing.sellerId)

  const runCheckout = async () => {
    if (busy || isOwn) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const { socialCreateMarketplaceOrder, socialPayMarketplaceOrder } = await import(
        "@/lib/social/client"
      )
      const nonce = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      const idempotencyKey = idempotencyKeyRef.current || `buy_${nonce}`
      idempotencyKeyRef.current = idempotencyKey
      const created = await socialCreateMarketplaceOrder({
        listingId: listing.id,
        quantity: 1,
        idempotencyKey,
      })
      if (!created.ok || !created.order) {
        const errCode = !created.ok ? String(created.error || "") : ""
        setErr(humanizeClientErrorCode(errCode, "Could not create order"))
        return
      }
      const orderId = String((created.order as { id?: string }).id || "")
      if (!orderId) {
        setErr("Order created without id. Check Orders before retrying.")
        return
      }
      const authoritativeCurrency = getMarketplaceOrderCurrency(created.order)
      if (!authoritativeCurrency) {
        setMsg("Your order may be reserved, but its payment currency could not be verified. Open Orders before taking another action.")
        setErr("Payment was not started because the server order did not return a supported currency.")
        return
      }
      emitMarketplaceEconomyRefresh("marketplace-order-create")
      setPayRail(authoritativeCurrency === "PI" ? "pi" : "ghc")

      if (authoritativeCurrency === "PI") {
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
      idempotencyKeyRef.current = null
      setMsg(authoritativeCurrency === "GHC"
        ? "Paid with GHC. Order confirmed — track it under Orders."
        : "Order payment confirmed — track it under Orders.")
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
      <WorkflowFeedback
        state={msg
          ? workflowFeedback(
              msg.toLowerCase().includes("complete pi") ? "info" : "success",
              msg,
              msg.toLowerCase().includes("track it") ? "Open Orders to follow the durable order lifecycle." : undefined,
            )
          : err
            ? workflowFeedback("error", err, "Review the payment or order details and try again when ready.")
            : workflowFeedback("idle", "")}
      />
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
  onAddToCart,
}: {
  listing: MarketplaceListing
  onBack: () => void
  onOpenListing?: (id: string) => void
  onSearchBrowse?: (q: string) => void
  onEditListing?: (listing: MarketplaceListing) => void
  onDelist?: (listing: MarketplaceListing) => void
  onRemoveListing?: (listing: MarketplaceListing) => void
  onAddToCart?: (listing: MarketplaceListing, variantId?: string) => void
}) {
  const effectiveStatus = listing.kind === "product" && listing.status === "active" && listing.availability <= 0
    ? "sold_out"
    : listing.status
  const chip = statusChip(effectiveStatus)
  const mediaItems = Array.isArray(listing.media) ? listing.media.filter(Boolean) : []
  const [mediaIndex, setMediaIndex] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState(listing.variants?.find((variant) => variant.active && (variant.available ?? variant.stockOnHand) > 0)?.id || "")
  useEffect(() => {
    const selectedStillAvailable = listing.variants?.some((variant) =>
      variant.id === selectedVariantId && variant.active && (variant.available ?? variant.stockOnHand) > 0
    )
    if (selectedStillAvailable) return
    setSelectedVariantId(listing.variants?.find((variant) => variant.active && (variant.available ?? variant.stockOnHand) > 0)?.id || "")
  }, [listing.id, listing.variants, selectedVariantId])
  const [saved, setSaved] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const media = mediaItems[mediaIndex] || mediaItems[0]
  const activeVariants = listing.variants?.filter((variant) => variant.active) || []
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId)
  const hasVariants = activeVariants.length > 0
  const canBuy = listing.status === "active" && (hasVariants ? Boolean(selectedVariant && (selectedVariant.available ?? selectedVariant.stockOnHand) > 0) : (listing.kind !== "product" || listing.availability > 0))
  const viewerId = IdentityService.getCurrentUserId() || ""
  const isOwner = isOwnedByCurrentUser(listing.sellerId)
  const relatedTokens = useMemo(() => relatedSearchTokens(listing), [listing])
  const relatedItems = useMemo(() => relatedListingsFor(listing, 6), [listing])
  const communitySuggestions = useMemo(() => suggestedCommunitiesFor(listing, 5), [listing])
  const when = listedWhen(listing.createdAt)
  const locationLine = [listing.location, when].filter(Boolean).join(" · ")
  const domainTrust = getMarketplaceDomain()
  const sellerTrust = useMemo(() => {
    try {
      return domainTrust?.getSellerProfile?.(listing.sellerId) || null
    } catch {
      return null
    }
  }, [domainTrust, listing.sellerId])
  const sellerReviews = useMemo(() => {
    try {
      return domainTrust?.getReviewsForSeller?.(listing.sellerId)?.slice(0, 5) || []
    } catch {
      return []
    }
  }, [domainTrust, listing.sellerId])
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ListingReportReason>("misleading")
  const [reportNote, setReportNote] = useState("")
  const [reportBusy, setReportBusy] = useState(false)

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
      <header className="gh-marketplace-header gh-marketplace-detail-header flex shrink-0 flex-col gap-1.5 border-b border-border/50 px-3 pb-1 pt-[max(0.25rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Search marketplace"
        >
          <Search size={18} className="text-muted-foreground" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto [touch-action:pan-y] overscroll-contain">
        <SurfaceIntro
          kicker="Commerce"
          title="Buy & sell with confidence"
          body="Browse listings, manage orders, and sell. Payments settle on the order flow — Wallet holds balances and History."
          tone="emerald"
        />

        {/* Hero media */}
        <div className="relative aspect-[4/3] w-full bg-muted/40">
          {media ? (
            <button
              type="button"
              className="absolute inset-0 block h-full w-full"
              aria-label="Hold listing photo to download"
              onContextMenu={(e) => { e.preventDefault(); if (media) void downloadMedia(media, { kind: "image", filename: listing.title }) }}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                const el = e.currentTarget
                const timer = window.setTimeout(() => {
                  if (media) void downloadMedia(media, { kind: "image", filename: listing.title })
                  try { if ("vibrate" in navigator) navigator.vibrate(10) } catch { /* */ }
                }, 500)
                const clear = () => window.clearTimeout(timer)
                el.addEventListener("pointerup", clear, { once: true })
                el.addEventListener("pointercancel", clear, { once: true })
              }}
            >
              <LazyImage variant="post-media" src={media} alt={listing.title} className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
            </button>
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
                <span
                  onContextMenu={(e) => { e.preventDefault(); if (src) void downloadMedia(src, { kind: "image" }) }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return
                    const el = e.currentTarget
                    const timer = window.setTimeout(() => { if (src) void downloadMedia(src, { kind: "image" }); try { if ("vibrate" in navigator) navigator.vibrate(10) } catch { /* */ } }, 500)
                    const clear = () => window.clearTimeout(timer)
                    el.addEventListener("pointerup", clear, { once: true })
                    el.addEventListener("pointercancel", clear, { once: true })
                  }}
                  className="block h-full w-full"
                ><LazyImage variant="post-media" src={src} alt="" className="h-full w-full object-cover pointer-events-none" /></span>
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

        {listing.productOptions?.length ? (
          <section className="border-b border-border/50 px-4 py-4">
            <h3 className="text-[15px] font-bold text-foreground">Available product options</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Options share the listed price and stock. Message the seller to confirm your choice before checkout.</p>
            <div className="mt-3 space-y-3">
              {listing.productOptions.map((option) => (
                <div key={option.name}>
                  <p className="text-[12px] font-semibold text-foreground">{option.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {option.values.map((value) => <span key={`${option.name}-${value}`} className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] text-foreground">{value}</span>)}
                  </div>
                </div>
              ))}
            </div>
            {!isOwner ? <button type="button" onClick={() => messageSeller("I would like to confirm product options before ordering.")} className="mt-3 min-h-10 rounded-full border border-border px-3 text-xs font-bold">Ask seller about options</button> : null}
          </section>
        ) : null}

        {/* Delivery & fulfillment */}
        <section className="border-b border-border/50 px-4 py-4">
          <h3 className="text-[15px] font-bold text-foreground">Delivery</h3>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {formatDeliveryLine(listing.shippingInfo, listing.location)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Mode is set by the seller. Confirm details in Messages before paying large amounts.
          </p>
        </section>

        {/* Seller information + trust */}
        <section className="border-b border-border/50 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-foreground">Seller information</h3>
            {!isOwner ? (
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="text-[11px] font-bold text-amber-800 dark:text-amber-300"
              >
                Report listing
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Store size={20} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-foreground">
                {sellerTrust?.displayName || "Seller on GreenHaven"}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {formatRating(Number(sellerTrust?.averageRating) || 0, Number(sellerTrust?.reviewCount) || 0)}
                {sellerTrust?.completedOrders ? ` · ${sellerTrust.completedOrders} completed` : ""}
              </p>
              {sellerTrust?.identityVerified ? (
                <p className="mt-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Identity signals present</p>
              ) : (
                <p className="mt-0.5 text-[10px] text-muted-foreground">Verify details before high-value trades</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => messageSeller()}
              className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-[12px] font-bold text-foreground hover:bg-muted"
            >
              Message
            </button>
          </div>
          {sellerReviews.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {sellerReviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                  <p className="text-[11px] font-bold text-foreground">{r.rating}/5</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{r.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11px] text-muted-foreground">No completed-order reviews yet.</p>
          )}
          {reportOpen ? (
            <div className="mt-3 space-y-2 rounded-xl border border-amber-500/30 bg-amber-50/50 p-3 dark:bg-amber-950/20">
              <p className="text-[11px] font-semibold text-foreground">Report this listing</p>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ListingReportReason)}
                className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[12px]"
              >
                <option value="scam">Suspected scam</option>
                <option value="prohibited">Prohibited item</option>
                <option value="misleading">Misleading description</option>
                <option value="counterfeit">Counterfeit</option>
                <option value="other">Other</option>
              </select>
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Optional details"
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[12px]"
              />
              <button
                type="button"
                disabled={reportBusy}
                onClick={() => {
                  if (reportBusy) return
                  void (async () => {
                    setReportBusy(true)
                    try {
                      const response = await fetch(`/api/marketplace/listings/${encodeURIComponent(listing.id)}/report`, {
                        method: "POST",
                        credentials: "include",
                        cache: "no-store",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: reportReason, note: reportNote.trim() }),
                      })
                      const result = await response.json().catch(() => ({}))
                      if (!response.ok || result?.ok !== true || result?.durable !== true) {
                        const code = String(result?.error || "MARKETPLACE_REPORTS_UNAVAILABLE")
                        throw new Error(code === "CANNOT_REPORT_OWN_LISTING"
                          ? "You cannot report your own listing."
                          : code === "LISTING_NOT_FOUND"
                            ? "This listing is no longer available."
                            : code === "RATE_LIMITED"
                              ? "Too many reports. Please try again later."
                              : "Report service is temporarily unavailable. Your report was not submitted.")
                      }
                      setReportOpen(false)
                      setReportNote("")
                      window.dispatchEvent(new CustomEvent("ghc:toast", {
                        detail: {
                          message: result.duplicate
                            ? "Your earlier report is already recorded."
                            : "Your report was recorded for marketplace safety review.",
                          type: "success",
                        },
                      }))
                    } catch (error) {
                      window.dispatchEvent(new CustomEvent("ghc:toast", {
                        detail: { message: error instanceof Error ? error.message : "Report could not be submitted.", type: "error" },
                      }))
                    } finally {
                      setReportBusy(false)
                    }
                  })()
                }}
                className="w-full rounded-full bg-amber-700 py-2 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reportBusy ? "Submitting report…" : "Submit report"}
              </button>
            </div>
          ) : null}
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
                  className="gh-card-interactive overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-[var(--gh-card-shadow)] active:scale-[0.99]"
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
                      <DurableImage src={c.photo} alt="" className="h-full w-full object-cover" />
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
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{selectedVariant ? `${selectedVariant.price.toLocaleString()} ${selectedVariant.currency}` : formatPrice(listing)}</p>
            {hasVariants ? (
              <div className="mt-3 space-y-1.5">
                <label htmlFor={`variant-${listing.id}`} className="text-[11px] font-semibold text-foreground">Choose a SKU variant</label>
                <select id={`variant-${listing.id}`} value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">Select variant</option>
                  {activeVariants.map((variant) => <option key={variant.id} value={variant.id} disabled={(variant.available ?? variant.stockOnHand) < 1}>{variant.label} · {variant.sku} · {variant.price} {variant.currency} · {variant.available ?? variant.stockOnHand} available</option>)}
                </select>
                {selectedVariant ? <p className="text-[11px] text-muted-foreground">SKU {selectedVariant.sku} · {selectedVariant.available ?? selectedVariant.stockOnHand} available</p> : null}
              </div>
            ) : null}
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Price and availability are provided by the seller. Review payment details before confirming.
            </p>
            {canBuy ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onAddToCart?.(listing, selectedVariant?.id)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-600/35 bg-emerald-50 px-3 text-[12px] font-bold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-200"
                  >
                    <ShoppingCart size={15} aria-hidden />
                    Add to cart
                  </button>
                </div>
                {!hasVariants ? <CheckoutPanel listing={listing} /> : <p className="mt-2 text-[10px] text-muted-foreground">Variant price and stock are revalidated atomically when you reserve the order.</p>}
              </>
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
  availability,
  setAvailability,
  currency,
  setCurrency,
  description,
  setDescription,
  category,
  setCategory,
  location,
  setLocation,
  deliveryMode,
  setDeliveryMode,
  deliveryNotes,
  setDeliveryNotes,
  productOptionsText,
  setProductOptionsText,
  productVariantsText,
  setProductVariantsText,
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
  availability: string
  setAvailability: (v: string) => void
  currency: "GHC" | "PI"
  setCurrency: (v: "GHC" | "PI") => void
  description: string
  setDescription: (v: string) => void
  category: string
  setCategory: (v: string) => void
  location: string
  setLocation: (v: string) => void
  deliveryMode: DeliveryMode
  setDeliveryMode: (v: DeliveryMode) => void
  deliveryNotes: string
  setDeliveryNotes: (v: string) => void
  productOptionsText: string
  setProductOptionsText: (v: string) => void
  productVariantsText: string
  setProductVariantsText: (v: string) => void
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

  const regional = useRegionalContext()
  const wt = (key: Parameters<typeof getWorkflowMessage>[0]) => getWorkflowMessage(key, regional.locale)

  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div>
        <h2 className="text-[17px] font-bold text-foreground">
          {mode === "edit" ? wt("editListing") : wt("sellMarketplace")}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {mode === "edit"
            ? "Updates cost half the listing fee. Listing fees are non-refundable platform charges."
            : "Priced in ₲ GHC or π Pi. A non-refundable π listing fee is charged when you publish (Pi-only commerce for ecosystem listing)."}
        </p>
      </div>

      <div>
        <span className="text-[12px] font-bold text-muted-foreground">{wt("photos")}</span>
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
        <span className="text-[12px] font-bold text-muted-foreground">Base listing price · {wt("price")}</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="0.00"
          aria-describedby="gh-market-base-price-help"
        />
        <span id="gh-market-base-price-help" className="mt-1 block text-[11px] text-muted-foreground">Used for listings without active SKU variants. When variants are defined, each SKU's own price is charged and shown to buyers.</span>
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Product options (informational)</span>
        <textarea
          value={productOptionsText}
          onChange={(e) => setProductOptionsText(e.target.value.slice(0, 1200))}
          rows={3}
          maxLength={1200}
          className="mt-1 w-full resize-y rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={"Size: S, M, L\nColour: Black, White"}
          aria-describedby="gh-market-options-help"
        />
        <span id="gh-market-options-help" className="mt-1 block text-[11px] text-muted-foreground">Up to 4 descriptive groups, 12 values each. These are informational only; use SKU variants below for independent prices and inventory.</span>
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">SKU variants (optional)</span>
        <textarea value={productVariantsText} onChange={(event) => setProductVariantsText(event.target.value.slice(0, 12000))} rows={4} maxLength={12000}
          className="mt-1 w-full resize-y rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={"TSHIRT-S-BLK | Small / Black | 12.50 | 8\nTSHIRT-M-BLK | Medium / Black | 12.50 | 12"}
          aria-describedby="gh-market-variants-help" />
        <span id="gh-market-variants-help" className="mt-1 block text-[11px] text-muted-foreground">One real SKU per line: SKU | buyer-facing variant label | unit price | on-hand stock. Up to 100 SKUs; each has its own price and inventory. Saving deactivates omitted SKUs; existing reserved stock is protected.</span>
      </label>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Base / shared stock fallback</span>
        <input
          value={availability}
          onChange={(e) => setAvailability(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-describedby="gh-market-stock-help"
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="1"
        />
        <span id="gh-market-stock-help" className="mt-1 block text-[11px] text-muted-foreground">Used only when no active SKU variants exist. With variants, available stock is derived from each SKU's on-hand minus reserved units.</span>
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
      <div className="block">
        <span className="text-[12px] font-bold text-muted-foreground">Delivery mode</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(Object.keys(DELIVERY_MODE_LABELS) as DeliveryMode[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setDeliveryMode(id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                deliveryMode === id
                  ? "bg-emerald-700 text-white"
                  : "border border-border/70 bg-card text-muted-foreground"
              }`}
            >
              {DELIVERY_MODE_LABELS[id]}
            </button>
          ))}
        </div>
        <input
          value={deliveryNotes}
          onChange={(e) => setDeliveryNotes(e.target.value.slice(0, 200))}
          className="mt-2 w-full rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Optional notes (e.g. ships in 2 days, meetup at park)"
        />
      </div>
      <label className="block">
        <span className="text-[12px] font-bold text-muted-foreground">{wt("description")}</span>
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
          {busy ? (mode === "edit" ? wt("saving") : wt("posting")) : cta}
        </button>
      </div>
    </div>
  )
}

function emitMarketplaceEconomyRefresh(reason: string) {
  emitSectionRefresh("marketplace", { reason })
  emitSectionRefresh("wallet", { reason })
  try {
    window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason } }))
    window.dispatchEvent(new CustomEvent("ghc:wallet-synced", { detail: { reason } }))
  } catch { /* */ }
}


function CartPanel({
  items,
  onChange,
  onRemove,
  onClear,
  onContinueShopping,
}: {
  items: MarketplaceCartItem[]
  onChange: (listingId: string, quantity: number, variantId?: string) => void
  onRemove: (listingId: string) => void
  onClear: () => void
  onContinueShopping: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkoutProgress, setCheckoutProgress] = useState<string | null>(null)
  // Retain per-line keys across retries so a lost response cannot create a
  // second reservation for the same cart line. Clear only after checkout completes.
  const checkoutKeysRef = useRef(new Map<string, string>())

  // Phase 2: match sellerId against all session identity aliases (Pi UID + canonical id).
  // Read live IdentityService inside the memo so login/hydration updates apply.
  const ownItems = useMemo(
    () => items.filter((i) => isOwnedByCurrentUser(i.sellerId)),
    [items],
  )
  const purchasableItems = useMemo(
    () => items.filter((i) => !isOwnedByCurrentUser(i.sellerId)),
    [items],
  )
  const totals = useMemo(() => {
    // Phase 2: estimated total excludes own listings (not checkout-eligible)
    const map = new Map<string, number>()
    for (const item of purchasableItems) {
      const currency = (item.currency || "GHC").toUpperCase()
      map.set(currency, (map.get(currency) || 0) + Math.max(0, Number(item.price) || 0) * item.quantity)
    }
    return map
  }, [purchasableItems])

  const checkout = async () => {
    if (busy || !items.length) return
    if (ownItems.length && !purchasableItems.length) {
      setError("You can't buy your own listing. Remove it from the cart to continue.")
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    setCheckoutProgress(null)
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    const hardTimeout = typeof window !== "undefined"
      ? window.setTimeout(() => {
          try { controller?.abort() } catch { /* */ }
        }, 90_000)
      : null
    const created: Array<{ id: string; item: MarketplaceCartItem; currency: MarketplaceCurrency | null }> = []
    const paidGhcIds: string[] = []
    try {
      const { socialCreateMarketplaceOrder, socialPayMarketplaceOrder } = await import("@/lib/social/client")
      // Phase 3: reserve every purchasable line with stable idempotency; never invent payment success.
      const total = purchasableItems.length
      for (let i = 0; i < purchasableItems.length; i++) {
        if (controller?.signal?.aborted) throw new Error("Checkout timed out")
        const item = purchasableItems[i]
        setCheckoutProgress(`Reserving ${i + 1} of ${total}: ${item.title}`)
        const lineKey = `${item.listingId}:${item.variantId || "legacy"}:${item.quantity}:${item.sellerId}`
        let idempotencyKey = checkoutKeysRef.current.get(lineKey)
        if (!idempotencyKey) {
          const nonce = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
          idempotencyKey = `cart_${nonce}`
          checkoutKeysRef.current.set(lineKey, idempotencyKey)
        }
        const result = await socialCreateMarketplaceOrder({
          listingId: item.listingId,
          variantId: item.variantId,
          quantity: item.quantity,
          idempotencyKey,
        })
        if (!result.ok || !result.order) {
          const code = String(result.error || "")
          throw new Error(humanizeClientErrorCode(code, `Could not reserve ${item.title}`))
        }
        const id = String((result.order as { id?: string }).id || "")
        if (!id) throw new Error(`Order created without an id for ${item.title}`)
        // Record the reservation before validating its response so a malformed
        // response still warns the buyer to inspect Orders rather than retry blindly.
        const currency = getMarketplaceOrderCurrency(result.order)
        created.push({ id, item, currency })
        if (!currency) throw new Error(`Order for ${item.title} was reserved, but the server did not return a supported currency. Open Orders before retrying.`)
      }

      if (!created.length) {
        setError("You can't buy your own listing. Remove it from the cart to continue.")
        return
      }

      const piOrders = created.filter(({ currency }) => currency === "PI")
      const ghcOrders = created.filter(({ currency }) => currency === "GHC")
      for (let i = 0; i < ghcOrders.length; i++) {
        if (controller?.signal?.aborted) throw new Error("Checkout timed out")
        const { id, item } = ghcOrders[i]
        setCheckoutProgress(`Paying GHC ${i + 1} of ${ghcOrders.length}: ${item.title}`)
        const paid = await socialPayMarketplaceOrder(id, "ghc")
        if (!paid.ok) {
          throw new Error(
            humanizeClientErrorCode(paid.error, paid.message || "GHC payment failed — check available balance"),
          )
        }
        paidGhcIds.push(id)
      }

      // Remove only successfully reserved lines. Preserve own listings and any
      // unrelated cart edits made while the asynchronous checkout was running.
      const completedLineIds = created.map(({ item }) => item.listingId)
      removeMarketplaceCartItemsByIds(completedLineIds)
      for (const { item } of created) {
        checkoutKeysRef.current.delete(`${item.listingId}:${item.variantId || "legacy"}:${item.quantity}:${item.sellerId}`)
      }

      if (piOrders.length === 1) {
        const piOrder = piOrders[0]
        setCheckoutProgress("Opening Pi payment…")
        openPayForListing(
          {
            listingId: piOrder.item.listingId,
            sellerId: piOrder.item.sellerId,
            title: piOrder.item.title,
            orderId: piOrder.id,
          },
          "pi",
        )
        setMessage(
          ghcOrders.length
            ? "GHC items paid. Complete Pi payment for the remaining item — orders stay protected under Orders."
            : "Complete Pi payment to finish this order. Status stays visible under Orders.",
        )
      } else if (piOrders.length > 1) {
        // Phase 3: do not drop secondary Pi lines — open first, point user at Orders for the rest.
        const first = piOrders[0]
        openPayForListing(
          {
            listingId: first.item.listingId,
            sellerId: first.item.sellerId,
            title: first.item.title,
            orderId: first.id,
          },
          "pi",
        )
        setMessage(
          `Pi payment started for “${first.item.title}”. ${piOrders.length - 1} more Pi order(s) are reserved under Orders — complete each payment there. GHC lines already paid stay settled.`,
        )
      } else {
        setMessage("Cart checkout completed. Your orders are protected under Orders.")
      }
      emitMarketplaceEconomyRefresh("marketplace-cart-checkout")
      window.dispatchEvent(new CustomEvent("ghc:marketplace-order-changed"))
    } catch (e) {
      const aborted = controller?.signal?.aborted
      const reservedNote =
        created.length > 0
          ? ` ${created.length} order(s) may already be reserved${paidGhcIds.length ? ` (${paidGhcIds.length} GHC paid)` : ""}. Open Orders before retrying — cart line keys were kept for unpaid lines.`
          : ""
      setError(
        aborted
          ? `Checkout timed out.${reservedNote}`
          : `${toClientSafeErrorMessage(e, "Cart checkout failed")}${reservedNote}`,
      )
    } finally {
      if (hardTimeout != null) window.clearTimeout(hardTimeout)
      setCheckoutProgress(null)
      setBusy(false)
    }
  }


  if (!items.length) {
    return (
      <div className="mx-auto max-w-2xl px-1 py-8">
        <div className="rounded-[1.5rem] border border-border/60 bg-card p-7 text-center shadow-[var(--gh-card-shadow)]">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <ShoppingCart size={28} aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-bold">Your cart is ready for your next find</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Save products here while you compare sellers, quantities, delivery details and payment options. Checkout revalidates inventory and payment on the server.
          </p>
          <button type="button" onClick={onContinueShopping} className="mt-5 min-h-11 rounded-full bg-[var(--gh-green)] px-5 text-sm font-bold text-white">
            Continue shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-1 pb-8">
      <div className="rounded-[1.4rem] border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Your basket</p>
            <h2 className="mt-1 text-xl font-bold">Ready to checkout</h2>
            <p className="mt-1 text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"} · prices, currency and inventory are revalidated by the server at checkout</p>
          </div>
          <button type="button" onClick={onClear} disabled={busy} className="min-h-9 rounded-full border border-border px-3 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-50">Clear</button>
        </div>
        {ownItems.length > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100" role="status">
            <p>
              {ownItems.length === 1
                ? "One item is your own listing and can't be purchased."
                : `${ownItems.length} items are your own listings and can't be purchased.`}
            </p>
            <button
              type="button"
              className="mt-2 rounded-full border border-amber-400/70 bg-white px-3 py-1 text-[11px] font-bold text-amber-950 dark:bg-amber-900/40 dark:text-amber-50"
              onClick={() => {
                for (const own of ownItems) onRemove(own.listingId)
              }}
            >
              Remove my listings from cart
            </button>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/60 p-3"><p className="text-[10px] text-muted-foreground">Items</p><p className="mt-1 text-sm font-bold">{items.reduce((n, i) => n + i.quantity, 0)}</p></div>
          <div className="rounded-xl bg-muted/60 p-3"><p className="text-[10px] text-muted-foreground">Sellers</p><p className="mt-1 text-sm font-bold">{new Set(items.map((i) => i.sellerId)).size}</p></div>
          <div className="rounded-xl bg-muted/60 p-3"><p className="text-[10px] text-muted-foreground">Currencies</p><p className="mt-1 text-sm font-bold">{totals.size}</p></div>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const lineTotal = (Number(item.price) || 0) * item.quantity
          const currency = (item.currency || "GHC").toUpperCase()
          const isOwn = isOwnedByCurrentUser(item.sellerId)
          return (
            <article key={`${item.listingId}:${item.variantId || "legacy"}`} className={`flex gap-3 rounded-2xl border p-3 shadow-sm ${isOwn ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20" : "border-border/60 bg-card"}`}>
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted/60">
                {item.media ? <LazyImage src={item.media} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package size={22} className="text-muted-foreground" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-bold">{item.title}</h3>
                    {item.variantLabel ? <p className="mt-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">{item.variantLabel} · SKU {item.variantSku}</p> : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {isOwn
                        ? "Your listing · can't be purchased"
                        : item.sellerName
                          ? `Seller · ${item.sellerName}`
                          : "Seller details unavailable"}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRemove(item.listingId)} disabled={busy} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40" aria-label={`Remove ${item.title}`}><X size={15} /></button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-full border border-border/70 bg-background">
                    <button type="button" onClick={() => onChange(item.listingId, item.quantity - 1, item.variantId)} disabled={busy || item.quantity <= 1} className="flex h-8 w-8 items-center justify-center disabled:opacity-30" aria-label="Decrease quantity"><Minus size={13} /></button>
                    <span className="min-w-7 text-center text-xs font-bold">{item.quantity}</span>
                    <button type="button" onClick={() => onChange(item.listingId, item.quantity + 1, item.variantId)} disabled={busy || (Boolean(item.availability) && item.quantity >= Number(item.availability))} className="flex h-8 w-8 items-center justify-center disabled:opacity-30" aria-label="Increase quantity"><Plus size={13} /></button>
                  </div>
                  <p className="text-sm font-extrabold">{currency === "GHC" ? "₲ " : ""}{lineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}{currency === "GHC" ? "" : currency === "PI" ? " π" : ` ${currency}`}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="rounded-[1.4rem] border border-emerald-600/20 bg-emerald-50/50 p-4 dark:bg-emerald-950/15">
        <div className="flex items-center gap-2 text-[12px] font-bold"><ShieldCheck size={16} className="text-emerald-700 dark:text-emerald-300" /> Protected marketplace checkout</div>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Checkout journey">
          <div className="rounded-xl bg-background/70 p-2"><CheckCircle2 size={14} className="text-emerald-700" /><p className="mt-1 text-[10px] font-bold">1. Revalidate</p><p className="text-[9px] text-muted-foreground">Price & stock</p></div>
          <div className="rounded-xl bg-background/70 p-2"><ShieldCheck size={14} className="text-emerald-700" /><p className="mt-1 text-[10px] font-bold">2. Secure order</p><p className="text-[9px] text-muted-foreground">Server record</p></div>
          <div className="rounded-xl bg-background/70 p-2"><Clock3 size={14} className="text-emerald-700" /><p className="mt-1 text-[10px] font-bold">3. Track</p><p className="text-[9px] text-muted-foreground">Until complete</p></div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="flex gap-2"><Truck size={15} className="mt-0.5 shrink-0 text-muted-foreground" /><p className="text-[11px] leading-relaxed text-muted-foreground">Delivery terms stay with each seller and order.</p></div>
          <div className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-muted-foreground" /><p className="text-[11px] leading-relaxed text-muted-foreground">Inventory is reserved through the server order flow.</p></div>
          <div className="flex gap-2"><Zap size={15} className="mt-0.5 shrink-0 text-muted-foreground" /><p className="text-[11px] leading-relaxed text-muted-foreground">GHC and Pi payment rails remain separate.</p></div>
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">Estimated total</p><div className="text-right">{Array.from(totals.entries()).map(([currency, amount]) => <p key={currency} className="text-base font-extrabold">{currency === "GHC" ? "₲ " : ""}{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{currency === "GHC" ? "" : ` ${currency === "PI" ? "π" : currency}`}</p>)}</div></div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Estimate only — final totals, inventory and fees are confirmed by the server at checkout. Own listings are excluded.
        </p>
        {checkoutProgress ? (
          <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-900 dark:text-emerald-100" role="status" aria-live="polite">
            {checkoutProgress}
          </p>
        ) : null}
        {message ? <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">{message}</p> : null}
        {error ? <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-700 dark:text-red-300">{error}</p> : null}
        <button
          type="button"
          disabled={busy || purchasableItems.length === 0}
          aria-busy={busy || undefined}
          aria-disabled={busy || purchasableItems.length === 0}
          onClick={() => void checkout()}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gh-green)] px-5 text-sm font-bold text-white shadow-md shadow-emerald-700/20 transition active:scale-[0.99] disabled:opacity-60 motion-safe:active:scale-[0.99]"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
          {busy
            ? "Securing your orders…"
            : purchasableItems.length === 0
              ? "Remove your own listings to checkout"
              : "Checkout securely"}
        </button>
      </div>
    </div>
  )
}

function SellerCommandCenter({
  listings,
  orders,
  loading,
  onNewListing,
  onOpenOrders,
}: {
  listings: MarketplaceListing[]
  orders: MarketplaceOrder[]
  loading: boolean
  onNewListing: () => void
  onOpenOrders: () => void
}) {
  const sellerOrders = useMemo(() => orders.filter((order) => isOwnedByCurrentUser(order.sellerId)), [orders])
  const isSoldOut = (listing: MarketplaceListing) => listing.status === "sold_out" || (listing.kind === "product" && listing.availability <= 0)
  const activeListings = listings.filter((listing) => listing.status === "active" && !isSoldOut(listing)).length
  const pausedListings = listings.filter((listing) => listing.status === "paused").length
  const soldOutListings = listings.filter(isSoldOut).length
  const draftListings = listings.filter((listing) => listing.status === "draft").length
  const lowStockListings = listings.filter((listing) => listing.kind === "product" && listing.status === "active" && listing.availability > 0 && listing.availability <= 3).length
  const incompleteListings = listings.filter((listing) => listing.status === "active" && (!listing.description?.trim() || !listing.media?.length || !listing.category?.trim())).length
  const openOrders = sellerOrders.filter((order) => !["completed", "cancelled", "refunded"].includes(String(order.status))).length
  const completedOrders = sellerOrders.filter((order) => String(order.status) === "completed").length
  const needsAttention = sellerOrders.filter((order) => ["created", "payment_pending", "payment_verified", "paid", "confirmed", "fulfilling", "disputed"].includes(String(order.status))).length

  return (
    <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-sm" aria-label="Seller command center">
      <div className="border-b border-border/50 bg-gradient-to-br from-emerald-500/10 via-background to-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Seller Centre</p>
            <h2 className="mt-1 text-lg font-extrabold">Run your GreenHaven storefront</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">Monitor stock risk, listing quality and order work from one place. Metrics are derived from the currently loaded durable seller listings and orders; no revenue is estimated from stale client prices.</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><BarChart3 size={18} /></span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-live="polite">
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Active</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : activeListings}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Paused</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : pausedListings}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Sold out</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : soldOutListings}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Drafts</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : draftListings}</p></div>
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/70 p-3 dark:bg-amber-950/20"><p className="text-[10px] text-muted-foreground">Low stock</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : lowStockListings}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Needs polish</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : incompleteListings}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Open orders</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : openOrders}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Needs attention</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : needsAttention}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Completed</p><p className="mt-1 text-lg font-extrabold">{loading ? "—" : completedOrders}</p></div>
        </div>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        <button type="button" onClick={onNewListing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--gh-green)] px-4 text-sm font-bold text-white"><Plus size={15} /> Create listing</button>
        <button type="button" onClick={onOpenOrders} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold"><Package size={15} /> Manage seller orders{needsAttention ? ` · ${needsAttention}` : ""}</button>
      </div>
    </section>
  )
}


function MarketplaceOutcomeCenter({
  orders,
  cartCount,
  savedCount,
  onOpenCart,
  onOpenOrders,
  onOpenSellerCentre,
  onOpenSaved,
  onBrowse,
}: {
  orders: MarketplaceOrder[]
  cartCount: number
  savedCount: number
  onOpenCart: () => void
  onOpenOrders: () => void
  onOpenSellerCentre: () => void
  onOpenSaved: () => void
  onBrowse: () => void
}) {
  const viewerId = IdentityService.getCurrentUserId() || ""
  const buyerOrders = orders.filter((order) => order.buyerId === viewerId)
  const sellerOrders = orders.filter((order) => isOwnedByCurrentUser(order.sellerId))
  const terminal = new Set(["completed", "cancelled", "refunded"])
  const activeBuyerOrders = buyerOrders.filter((order) => !terminal.has(String(order.status)))
  const sellerAttention = sellerOrders.filter((order) => ["created", "payment_pending", "payment_verified", "paid", "confirmed", "fulfilling", "disputed"].includes(String(order.status)))

  let kicker = "Marketplace next step"
  let title = "Discover something useful"
  let detail = "Explore real products, services and opportunities, then use protected order flows when you are ready to transact."
  let actionLabel = "Browse marketplace"
  let onAction = onBrowse
  let Icon = Store

  if (sellerAttention.length > 0) {
    kicker = "Seller attention"
    title = `${sellerAttention.length} seller ${sellerAttention.length === 1 ? "order needs" : "orders need"} attention`
    detail = "Review the order lifecycle and move confirmed buyer activity toward successful completion."
    actionLabel = "Open Seller Centre"
    onAction = onOpenSellerCentre
    Icon = BarChart3
  } else if (activeBuyerOrders.length > 0) {
    kicker = "Order progress"
    title = `${activeBuyerOrders.length} active ${activeBuyerOrders.length === 1 ? "order" : "orders"}`
    detail = "Track payment, confirmation and fulfilment from the durable order record instead of guessing what happens next."
    actionLabel = "Track orders"
    onAction = onOpenOrders
    Icon = Package
  } else if (cartCount > 0) {
    kicker = "Ready when you are"
    title = `${cartCount} ${cartCount === 1 ? "item" : "items"} in your cart`
    detail = "Review quantities and server-authoritative totals before starting protected checkout."
    actionLabel = "Review cart"
    onAction = onOpenCart
    Icon = ShoppingCart
  } else if (savedCount > 0) {
    kicker = "Saved for later"
    title = `${savedCount} saved ${savedCount === 1 ? "listing" : "listings"}`
    detail = "Return to the products or services you saved and decide whether they still fit what you need."
    actionLabel = "Review saved"
    onAction = onOpenSaved
    Icon = Bookmark
  }

  return (
    <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-[var(--gh-card-shadow)]" aria-label="Marketplace outcome centre">
      <div className="bg-gradient-to-br from-emerald-500/10 via-background to-background p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="gh-icon-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-emerald-700 dark:text-emerald-300" aria-hidden>
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{kicker}</p>
            <h2 className="mt-1 text-base font-extrabold tracking-[-0.01em] sm:text-lg">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">{detail}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Marketplace results">
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Active orders</p><p className="mt-1 text-lg font-extrabold">{activeBuyerOrders.length}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Cart</p><p className="mt-1 text-lg font-extrabold">{cartCount}</p></div>
          <div className="rounded-2xl border border-border/50 bg-background/80 p-3"><p className="text-[10px] text-muted-foreground">Saved</p><p className="mt-1 text-lg font-extrabold">{savedCount}</p></div>
        </div>
        <button type="button" onClick={onAction} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gh-green)] px-4 text-sm font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:w-auto">
          {actionLabel}
          <ArrowLeft size={15} className="rotate-180" aria-hidden />
        </button>
      </div>
    </section>
  )
}


function SellerFulfilmentControls({
  order,
  busy,
  onAction,
}: {
  order: MarketplaceOrder
  busy: boolean
  onAction: (action: string, payload?: Record<string, unknown>) => void
}) {
  const [method, setMethod] = useState<"shipping" | "pickup" | "digital">("shipping")
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [estimatedDelivery, setEstimatedDelivery] = useState("")
  const [note, setNote] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState("")

  if (order.status === "confirmed") {
    return <div className="mt-3 rounded-xl border border-emerald-600/25 bg-emerald-50/40 p-3 dark:bg-emerald-950/15">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-h-9 w-full items-center justify-between text-left text-xs font-bold">
        <span>Prepare fulfilment</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? <div className="mt-2 space-y-2">
        <label className="block text-[11px] font-semibold">Delivery method
          <select value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="shipping">Ship to buyer</option><option value="pickup">Local pickup / meetup</option><option value="digital">Digital product / service</option>
          </select>
        </label>
        {method === "shipping" ? <>
          <label className="block text-[11px] font-semibold">Carrier / courier
            <input value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={80} placeholder="e.g. DHL, Royal Mail, local courier" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-[11px] font-semibold">Tracking number
            <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={120} placeholder="Enter carrier tracking number" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-[11px] font-semibold">Tracking link (HTTPS)
            <input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} maxLength={500} type="url" placeholder="https://carrier.example/track/..." className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </> : null}
        <label className="block text-[11px] font-semibold">Estimated delivery (optional)
          <input type="date" value={estimatedDelivery} onChange={(event) => setEstimatedDelivery(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block text-[11px] font-semibold">Buyer update (optional)
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Add a short fulfilment update" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        {error ? <p role="alert" className="text-[11px] text-red-600">{error}</p> : null}
        <button type="button" disabled={busy || (method === "shipping" && (carrier.trim().length < 2 || trackingNumber.trim().length < 3))} onClick={() => {
          setError("")
          if (trackingUrl) { try { const parsed = new URL(trackingUrl); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); } catch { setError("Enter a valid HTTPS tracking link."); return } }
          onAction("seller_fulfill", { method, carrier, trackingNumber, trackingUrl, estimatedDeliveryAt: estimatedDelivery ? new Date(`${estimatedDelivery}T23:59:59`).toISOString() : undefined, note })
        }} className="min-h-10 w-full rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white disabled:opacity-50">Save fulfilment plan</button>
      </div> : null}
    </div>
  }
  if (order.status !== "fulfilling") return null
  if (!order.fulfilmentMethod) return <button type="button" disabled={busy} onClick={() => onAction("seller_mark_delivered")} className="min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white">Complete legacy delivery</button>
  if (order.fulfilmentMethod === "shipping" && order.deliveryStatus === "processing") {
    return <button type="button" disabled={busy} onClick={() => onAction("seller_dispatch")} className="min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white">Mark dispatched</button>
  }
  if ((order.fulfilmentMethod === "pickup" || order.fulfilmentMethod === "digital" || order.deliveryStatus === "shipped") && !["delivered", "service_active"].includes(String(order.deliveryStatus))) {
    return <button type="button" disabled={busy} onClick={() => onAction("seller_mark_delivered")} className="min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-xs font-bold text-white">{order.fulfilmentMethod === "digital" ? "Activate service" : "Mark delivered"}</button>
  }
  return null
}

function OrderTimelinePanel({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<Array<{ id: number; actorRole: string; eventType: string; note?: string; createdAt: number }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true); setError("")
    fetch(`/api/marketplace/orders/${encodeURIComponent(orderId)}/timeline`, { credentials: "include", cache: "no-store" })
      .then(async (response) => { const data = await response.json().catch(() => ({})); if (!response.ok || !data.ok) throw new Error(String(data.error || "Timeline unavailable")); return Array.isArray(data.events) ? data.events : [] })
      .then((rows) => { if (!cancelled) setEvents(rows) })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Timeline unavailable") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, orderId])
  return <div className="mt-3 border-t border-border/50 pt-2">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="min-h-8 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{open ? "Hide order activity" : "View order activity"}</button>
    {open ? <div className="mt-2 space-y-2">
      {loading ? <p className="text-[11px] text-muted-foreground">Loading verified order events…</p> : null}
      {error ? <p role="alert" className="text-[11px] text-amber-700">{error}</p> : null}
      {!loading && !error && events.length === 0 ? <p className="text-[11px] text-muted-foreground">No recorded order events yet.</p> : null}
      {events.map((event) => <div key={event.id} className="flex gap-2 text-[11px]"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-600"/><div><p className="font-semibold">{event.eventType.replace(/_/g, " ")} · {event.actorRole}</p>{event.note ? <p className="text-muted-foreground">{event.note}</p> : null}<p className="text-[10px] text-muted-foreground">{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Time unavailable"}</p></div></div>)}
    </div> : null}
  </div>
}

type MarketplaceBrowseFilters = { query: string; category: string; kind: ListingKind | "all"; delivery: DeliveryMode | "all"; priceCurrency: "all" | "GHC" | "PI"; minPrice: string; maxPrice: string; from: string; to: string }
const DEFAULT_MARKETPLACE_BROWSE_FILTERS: MarketplaceBrowseFilters = { query: "", category: "", kind: "all", delivery: "all", priceCurrency: "all", minPrice: "", maxPrice: "", from: "", to: "" }
function validateMarketplaceBrowseFilters(value: unknown): MarketplaceBrowseFilters {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00.000Z`)) && new Date(`${v}T00:00:00.000Z`).toISOString().slice(0,10) === v ? v : ""
  const amount = (v: unknown) => typeof v === "string" && /^\d{0,12}(?:\.\d{0,6})?$/.test(v) ? v : ""
  const from = date(raw.from), to = date(raw.to)
  const minPrice = amount(raw.minPrice), maxPrice = amount(raw.maxPrice)
  const invalidPriceOrder = minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice)
  return {
    query: typeof raw.query === "string" ? raw.query.slice(0,120) : "",
    category: typeof raw.category === "string" && MARKETPLACE_CATEGORIES.some((category) => category === raw.category) ? raw.category : "",
    kind: ["all", "product", "service", "opportunity"].includes(String(raw.kind)) ? raw.kind as MarketplaceBrowseFilters["kind"] : "all",
    delivery: ["all", "meetup", "shipping", "digital", "service"].includes(String(raw.delivery)) ? raw.delivery as MarketplaceBrowseFilters["delivery"] : "all",
    priceCurrency: ["all", "GHC", "PI"].includes(String(raw.priceCurrency)) ? raw.priceCurrency as MarketplaceBrowseFilters["priceCurrency"] : "all",
    minPrice: invalidPriceOrder ? "" : minPrice, maxPrice: invalidPriceOrder ? "" : maxPrice,
    from: from && to && from > to ? "" : from, to: from && to && from > to ? "" : to,
  }
}

/** Cart is separate from Wallet balances — do not mix badges or CTAs. */
export function MarketplaceScreen({
  onBack,
  initialListingId,
}: {
  onBack: () => void
  initialListingId?: string | null
}) {
  const regional = useRegionalContext()
  const msg = useCallback((key: Parameters<typeof getProductMessage>[0]) => getProductMessage(key, regional.locale), [regional.locale])
  const browseFilters = useAccountFilterState("marketplace-browse", IdentityService.getCurrentUserId() || "anonymous", DEFAULT_MARKETPLACE_BROWSE_FILTERS, validateMarketplaceBrowseFilters)
  const { query, category: categoryValue, kind: kindFilter, delivery: deliveryFilter, priceCurrency, minPrice, maxPrice, from: browseFrom, to: browseTo } = browseFilters.value
  const category = categoryValue || null
  const [browseOffset, setBrowseOffset] = useState(0)
  const resetBrowsePage = useCallback(() => setBrowseOffset(0), [])
  const setQuery = useCallback((value: string) => { resetBrowsePage(); browseFilters.update("query", value) }, [browseFilters, resetBrowsePage])
  const setCategory = useCallback((value: string | null) => { resetBrowsePage(); browseFilters.update("category", value || "") }, [browseFilters, resetBrowsePage])
  const setKindFilter = useCallback((value: ListingKind | "all") => { resetBrowsePage(); browseFilters.update("kind", value) }, [browseFilters, resetBrowsePage])
  const setDeliveryFilter = useCallback((value: DeliveryMode | "all") => { resetBrowsePage(); browseFilters.update("delivery", value) }, [browseFilters, resetBrowsePage])
  const setPriceCurrency = useCallback((value: MarketplaceBrowseFilters["priceCurrency"]) => { resetBrowsePage(); browseFilters.update("priceCurrency", value) }, [browseFilters, resetBrowsePage])
  const setMinPrice = useCallback((value: string) => { resetBrowsePage(); browseFilters.update("minPrice", value); if (value && maxPrice && Number(value) > Number(maxPrice)) browseFilters.update("maxPrice", "") }, [browseFilters, maxPrice, resetBrowsePage])
  const setMaxPrice = useCallback((value: string) => { resetBrowsePage(); browseFilters.update("maxPrice", value); if (value && minPrice && Number(value) < Number(minPrice)) browseFilters.update("minPrice", "") }, [browseFilters, minPrice, resetBrowsePage])
  const setBrowseFrom = useCallback((value: string) => { resetBrowsePage(); browseFilters.update("from", value); if (value && browseTo && value > browseTo) browseFilters.update("to", "") }, [browseFilters, browseTo, resetBrowsePage])
  const setBrowseTo = useCallback((value: string) => { resetBrowsePage(); browseFilters.update("to", value); if (value && browseFrom && value < browseFrom) browseFilters.update("from", "") }, [browseFilters, browseFrom, resetBrowsePage])
  const [selectedId, setSelectedId] = useState<string | null>(initialListingId || null)
  const [bucket, setBucket] = useState<"browse" | "orders" | "saved" | "sell" | "mine" | "cart">("browse")
  const [mineListings, setMineListings] = useState<MarketplaceListing[]>([])
  const [mineStatusFilter, setMineStatusFilter] = useState<"all" | "active" | "paused" | "sold_out" | "draft">("all")
  const [mineLoading, setMineLoading] = useState(false)
  const [showCategories, setShowCategories] = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)
  const [serverBrowseListings, setServerBrowseListings] = useState<MarketplaceListing[] | null>(null)
  const [serverBrowseState, setServerBrowseState] = useState<"loading" | "ready" | "unavailable" | "invalid">("loading")
  const [serverBrowseHasMore, setServerBrowseHasMore] = useState(false)
  const browseRequestRef = useRef(0)
  // Sell form (domain.createListing when available — no invented success)
  const [sellTitle, setSellTitle] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [sellAvailability, setSellAvailability] = useState("1")
  const [sellCurrency, setSellCurrency] = useState<"GHC" | "PI">("GHC")
  const [sellDesc, setSellDesc] = useState("")
  const [sellCategory, setSellCategory] = useState<string>(MARKETPLACE_CATEGORIES[0] || "Goods")
  const [sellLocation, setSellLocation] = useState("")
  const [sellDeliveryMode, setSellDeliveryMode] = useState<DeliveryMode>("meetup")
  const [sellDeliveryNotes, setSellDeliveryNotes] = useState("")
  const [sellProductOptionsText, setSellProductOptionsText] = useState("")
  const [sellProductVariantsText, setSellProductVariantsText] = useState("")
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
  const [orderRoleFilter, setOrderRoleFilter] = useState<"all" | "buying" | "selling">("all")
  const [reviewDraftOrderId, setReviewDraftOrderId] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState("")
  const [reviewBusy, setReviewBusy] = useState(false)
  const [browseSort, setBrowseSortState] = useState<BrowseSort>("newest")
  const setBrowseSort = useCallback((value: BrowseSort) => { resetBrowsePage(); setBrowseSortState(value) }, [resetBrowsePage])
  const [cartItems, setCartItems] = useState<MarketplaceCartItem[]>([])
  // Ignore stale async responses when users switch marketplace sections quickly.
  const savedRequestRef = useRef(0)
  const mineRequestRef = useRef(0)
  const ordersRequestRef = useRef(0)

  useEffect(() => () => {
    savedRequestRef.current += 1
    mineRequestRef.current += 1
    ordersRequestRef.current += 1
  }, [])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  const syncCart = useCallback(() => setCartItems(getMarketplaceCart()), [])

  useEffect(() => {
    syncCart()
    const handler = () => syncCart()
    window.addEventListener("ghc:marketplace-cart-changed", handler)
    // Keep multiple tabs/devices in the same browser profile coherent.
    window.addEventListener("storage", handler)
    return () => {
      window.removeEventListener("ghc:marketplace-cart-changed", handler)
      window.removeEventListener("storage", handler)
    }
  }, [syncCart])

  const addToCart = useCallback((listing: MarketplaceListing, variantId?: string) => {
    if (listing.status !== "active" || (listing.kind === "product" && listing.availability <= 0)) {
      try { window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "This listing is currently unavailable", type: "info" } })) } catch { /* */ }
      return
    }
    if (isOwnedByCurrentUser(listing.sellerId)) {
      try {
        window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "You can't add your own listing to the cart", type: "info" } }))
      } catch { /* */ }
      return
    }
    const sellerLabel =
      (listing as { sellerName?: string }).sellerName ||
      (listing as { sellerDisplayName?: string }).sellerDisplayName ||
      undefined
    const activeVariants = listing.variants?.filter((entry) => entry.active) || []
    const variant = variantId ? activeVariants.find((entry) => entry.id === variantId && (entry.available ?? entry.stockOnHand) > 0) : undefined
    if (activeVariants.length > 0 && !variant) {
      try { window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "Choose an available product variant first", type: "info" } })) } catch { /* */ }
      return
    }
    addMarketplaceCartItem({
      listingId: listing.id,
      ...(variant ? { variantId: variant.id, variantSku: variant.sku, variantLabel: variant.label } : {}),
      quantity: 1,
      title: listing.title,
      price: variant?.price ?? listing.price,
      currency: variant?.currency ?? listing.currency,
      sellerId: listing.sellerId,
      sellerName: sellerLabel,
      media: listing.media?.[0],
      availability: variant ? (variant.available ?? variant.stockOnHand) : listing.availability,
    })
    setBucket("cart")
    try {
      const next = getMarketplaceCart()
      const count = next.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
      window.dispatchEvent(new CustomEvent("ghc:marketplace-cart-changed", { detail: { count } }))
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "Added to cart", type: "success" } }))
    } catch { /* */ }
  }, [])

  const loadSavedListings = useCallback(async () => {
    const requestId = ++savedRequestRef.current
    setSavedLoading(true)
    try {
      const remote = await socialFetchMarketplaceSaved(100)
      if (requestId !== savedRequestRef.current) return
      // A failed or malformed response must not erase the last known saved list.
      if (!remote.ok || !remote.durable || !Array.isArray(remote.saved)) return
      const mapped = remote.saved
        .map((row) => mapSavedMarketplaceListingRecord(row))
        .filter((row): row is MarketplaceListing => Boolean(row))
      if (requestId === savedRequestRef.current) setSavedListings(mapped)
    } catch {
      // Keep the last known list; transient failures are retried on the next visit/refresh.
    } finally {
      if (requestId === savedRequestRef.current) setSavedLoading(false)
    }
  }, [])

  useEffect(() => {
    if (bucket !== "saved") return
    void loadSavedListings()
    const handler = () => void loadSavedListings()
    window.addEventListener("ghc:marketplace-saves-changed", handler)
    return () => window.removeEventListener("ghc:marketplace-saves-changed", handler)
  }, [bucket, loadSavedListings])

  const loadMineListings = useCallback(async () => {
    const requestId = ++mineRequestRef.current
    setMineLoading(true)
    try {
      const { socialFetchMarketplaceListings } = await import("@/lib/social/client")
      const remote = await socialFetchMarketplaceListings({ scope: "mine", limit: 100 })
      if (requestId !== mineRequestRef.current) return
      // Only a successful, well-formed response may replace the current view.
      if (!remote.ok || !Array.isArray(remote.listings)) return
      const mapped = remote.listings
        .map((row) => mapMarketplaceListingRecord(row))
        .filter((row): row is MarketplaceListing => Boolean(row))
      if (requestId === mineRequestRef.current) setMineListings(mapped)
    } catch {
      // Preserve the previous seller inventory on transient transport failures.
    } finally {
      if (requestId === mineRequestRef.current) setMineLoading(false)
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
    const requestId = ++ordersRequestRef.current
    setOrdersLoading(true)
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    const hardTimeout =
      typeof window !== "undefined"
        ? window.setTimeout(() => {
            try {
              controller?.abort()
            } catch { /* */ }
          }, 15_000)
        : null
    try {
      const res = await fetch("/api/marketplace/orders", {
        cache: "no-store",
        credentials: "include",
        signal: controller?.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (requestId !== ordersRequestRef.current) return
      // An authoritative empty array clears orders; transport/API failures do not.
      if (!res.ok || !Array.isArray(data.orders)) return
      const mapped = data.orders
        .map((order: unknown) => mapMarketplaceOrderRecord(order))
        .filter((order: MarketplaceOrder | null): order is MarketplaceOrder => Boolean(order))
      if (requestId === ordersRequestRef.current) setDurableOrders(mapped)
    } catch {
      // Retain last known durable orders; never turn a network failure into an empty order history.
    } finally {
      if (hardTimeout != null) window.clearTimeout(hardTimeout)
      if (requestId === ordersRequestRef.current) setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (bucket !== "orders" && bucket !== "mine") return
    void loadDurableOrders()
    const handler = () => void loadDurableOrders()
    window.addEventListener("ghc:marketplace-order-changed", handler)
    return () => window.removeEventListener("ghc:marketplace-order-changed", handler)
  }, [bucket, loadDurableOrders])

  // Screen-level soft refresh (focus / visible / online / marketplace-refresh event).
  // Replaces former per-ListingCard visibility listeners that stampeded the event bus.
  useSectionRefresh(
    "marketplace",
    (reason) => {
      try {
        refresh?.()
      } catch { /* */ }
      if (bucket === "orders" || reason === "manual" || reason === "event-forced") {
        void loadDurableOrders()
      }
      if (bucket === "saved") {
        void loadSavedListings?.()
      }
      if (bucket === "mine") {
        void loadMineListings?.()
      }
    },
    { minIntervalMs: 12_000 },
  )


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

  const runOrderAction = useCallback(async (orderId: string, action: string, payload: Record<string, unknown> = {}) => {
    if (orderBusy) return
    setOrderBusy(orderId + ":" + action)
    try {
      const res = await fetch(`/api/marketplace/orders/${encodeURIComponent(orderId)}/commerce`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action, ...payload }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(String(data.error || "Order action failed"))
      await loadDurableOrders()
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "Order updated", type: "success" } }))
    } catch (e) {
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: e instanceof Error ? e.message : "Order action failed", type: "error" } }))
    } finally { setOrderBusy(null) }
  }, [loadDurableOrders, orderBusy])

  const domain = getMarketplaceDomain()

  // Phase 10.2: server-side search/category/price/date filtering before pagination.
  useEffect(() => {
    let cancelled = false
    const requestId = ++browseRequestRef.current
    if ((minPrice || maxPrice) && priceCurrency === "all") {
      setServerBrowseListings(null)
      setServerBrowseHasMore(false)
      setServerBrowseState("invalid")
      return
    }
    setServerBrowseState("loading")
    if (browseOffset === 0) { setServerBrowseListings(null); setServerBrowseHasMore(false) }
    const timer = window.setTimeout(() => {
      ;(async () => {
        try {
          const { socialFetchMarketplaceListings } = await import("@/lib/social/client")
          const sort = browseSort === "price_asc" || browseSort === "price_desc" ? "price" : "updated_at"
          const direction = browseSort === "price_asc" ? "asc" : "desc"
          const remote = await socialFetchMarketplaceListings({
            scope: "public", limit: 50, offset: browseOffset, q: query.trim() || undefined, category: category || undefined,
            kind: kindFilter === "all" ? undefined : kindFilter,
            min: minPrice ? Number(minPrice) : undefined, max: maxPrice ? Number(maxPrice) : undefined,
            currency: priceCurrency === "all" ? undefined : priceCurrency,
            from: browseFrom || undefined, to: browseTo || undefined, sort, direction,
          })
          if (cancelled || requestId !== browseRequestRef.current) return
          if (!remote.ok || !remote.durable) {
            if (browseOffset === 0) setServerBrowseListings(null)
            setServerBrowseHasMore(false)
            setServerBrowseState("unavailable")
            return
          }
          const mapped = remote.listings.flatMap((row) => { const listing = mapMarketplaceListingRecord(row); return listing ? [listing] : [] })
          setServerBrowseListings((current) => {
            if (browseOffset === 0 || !current) return mapped
            const byId = new Map(current.map((listing) => [listing.id, listing]))
            for (const listing of mapped) byId.set(listing.id, listing)
            return Array.from(byId.values())
          })
          setServerBrowseHasMore(Boolean(remote.pagination?.hasMore))
          setServerBrowseState("ready")
          const KEY = "ghc_marketplace_listings_v1"
          try {
            const raw = window.localStorage.getItem(KEY)
            const local = raw ? JSON.parse(raw) as MarketplaceListing[] : []
            const byId = new Map<string, MarketplaceListing>()
            if (Array.isArray(local)) for (const item of local) if (item?.id) byId.set(item.id, item)
            for (const item of mapped) byId.set(item.id, item)
            window.localStorage.setItem(KEY, JSON.stringify(Array.from(byId.values()).slice(0, 500)))
          } catch { /* Cache is an optimization only; server response remains authoritative. */ }
        } catch {
          if (!cancelled && requestId === browseRequestRef.current) { if (browseOffset === 0) setServerBrowseListings(null); setServerBrowseHasMore(false); setServerBrowseState("unavailable") }
        }
      })()
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, category, kindFilter, minPrice, maxPrice, priceCurrency, browseFrom, browseTo, browseSort, browseOffset, tick])

    const listings = useMemo(() => {
    void tick
    if (!serverBrowseListings && !domain?.listListings) return [] as MarketplaceListing[]
    const raw = serverBrowseListings ?? (domain?.listListings?.({
      status: "active",
      category: category || undefined,
      kind: kindFilter === "all" ? undefined : kindFilter,
      query: query.trim() || undefined,
    }) || [])
    const deliveryFiltered = deliveryFilter === "all"
      ? raw
      : raw.filter((listing) => parseDeliveryMode(listing.shippingInfo) === deliveryFilter)
    const ranged = deliveryFiltered.filter((listing) => matchesFilterCurrencyRange(
      listing.price,
      listing.currency,
      { min: minPrice === "" ? null : Number(minPrice), max: maxPrice === "" ? null : Number(maxPrice) },
      priceCurrency,
    ))
    return sortMarketplaceListings(ranged, browseSort)
  }, [domain, category, kindFilter, deliveryFilter, query, tick, browseSort, serverBrowseListings, minPrice, maxPrice, priceCurrency])

  const filteredMineListings = useMemo(() => {
    if (mineStatusFilter === "all") return mineListings
    if (mineStatusFilter === "sold_out") {
      return mineListings.filter((listing) => listing.status === "sold_out" || (listing.kind === "product" && listing.availability <= 0))
    }
    if (mineStatusFilter === "active") {
      return mineListings.filter((listing) => listing.status === "active" && !(listing.kind === "product" && listing.availability <= 0))
    }
    return mineListings.filter((listing) => listing.status === mineStatusFilter)
  }, [mineListings, mineStatusFilter])

  const hasBrowseFilters = Boolean(query.trim() || category || kindFilter !== "all" || deliveryFilter !== "all" || priceCurrency !== "all" || minPrice || maxPrice || browseFrom || browseTo)

    const orders = useMemo(() => {
    void tick
    let list: MarketplaceOrder[] = []
    if (durableOrders.length) list = durableOrders
    else if (domain?.getOrders) {
      try { list = domain.getOrders?.() || [] } catch { list = [] }
    }
    const viewerId = IdentityService.getCurrentUserId() || ""
    if (orderRoleFilter === "buying") {
      list = list.filter((o) => o.buyerId === viewerId)
    } else if (orderRoleFilter === "selling") {
      list = list.filter((o) => isOwnedByCurrentUser(o.sellerId))
    }
    return [...list].sort((a, b) => (Number(b.updatedAt || b.createdAt) || 0) - (Number(a.updatedAt || a.createdAt) || 0))
  }, [domain, tick, durableOrders, orderRoleFilter])

  const outcomeOrders = useMemo(() => {
    if (durableOrders.length) return durableOrders
    if (!domain?.getOrders) return [] as MarketplaceOrder[]
    try { return domain.getOrders?.() || [] } catch { return [] as MarketplaceOrder[] }
  }, [domain, durableOrders])

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
          shippingInfo: row.shippingInfo ? String(row.shippingInfo) : undefined,
          sellerId: String(row.sellerId || row.seller_id || ""),
          availability: Number.isFinite(Number(row.availability)) ? Math.max(0, Math.floor(Number(row.availability))) : 0,
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
      if (bucketNext === "sell" || bucketNext === "mine" || bucketNext === "orders" || bucketNext === "saved" || bucketNext === "browse" || bucketNext === "cart") {
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
        onAddToCart={addToCart}
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
          setSellAvailability(String(Math.max(0, Math.floor(Number(listing.availability) || 0))))
          setSellCurrency((listing.currency || "GHC").toUpperCase() === "PI" ? "PI" : "GHC")
          setSellDesc(listing.description || "")
          setSellCategory(listing.category || MARKETPLACE_CATEGORIES[0] || "Goods")
          setSellLocation(listing.location || "")
          setSellDeliveryMode(parseDeliveryMode(listing.shippingInfo) || "meetup")
          setSellDeliveryNotes(String(listing.shippingInfo || "").replace(/^(meetup|shipping|digital|service)\s*:\s*/i, ""))
          setSellProductOptionsText(productOptionsToText(listing.productOptions))
          setSellProductVariantsText(productVariantsToText(listing.variants))
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
    <div className="gh-marketplace-shell gh-world-marketplace flex h-full min-h-0 flex-col bg-background text-foreground" role="region" aria-label={msg("marketplaceTitle")}>
      <header className="gh-marketplace-header flex shrink-0 flex-col gap-1 border-b border-border/50 px-3 pb-1 pt-[max(0.25rem,env(safe-area-inset-top,0px))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="gh-type-title truncate font-bold">{msg("marketplaceTitle")}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {msg("buySellSubtitle")}
            </p>
          </div>
          <span className="gh-icon-tile flex h-7 w-7 items-center justify-center rounded-lg" aria-hidden>
            <ShoppingBag size={16} />
          </span>
        </div>

        {/* FB-style action chips */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none" role="toolbar" aria-label="Marketplace tools">
          {[
            { id: "cart" as const, label: `${msg("cart")}${cartItems.length ? ` · ${cartItems.length}` : ""}`, icon: ShoppingCart },
            { id: "browse" as const, label: msg("browse"), icon: Store },
            { id: "sell" as const, label: msg("sell"), icon: Plus },
            { id: "mine" as const, label: msg("sellerCentre"), icon: BarChart3 },
            { id: "orders" as const, label: msg("orders"), icon: Package },
            { id: "saved" as const, label: msg("saved"), icon: Bookmark },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setBucket(chip.id)
                if (chip.id === "browse") setShowCategories(true)
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
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
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              showCategories && bucket === "browse"
                ? "bg-card text-foreground ring-1 ring-border shadow-sm"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            <Tag size={14} aria-hidden />
            {msg("categories")}
          </button>
          <button
            type="button"
            onClick={() => {
              setBucket("browse")
              setSearchFocused(true)
              requestAnimationFrame(() => searchRef.current?.focus())
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted/80"
          >
            <Search size={14} aria-hidden />
            {msg("searchListings")}
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
                placeholder={msg("searchListings")}
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
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" role="group" aria-label="Categories">
                <button
                  type="button"
                  aria-pressed={!category}
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
                    aria-pressed={category === c}
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
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Refine marketplace listings">
              <label className="flex min-h-9 items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 text-[11px] font-semibold text-muted-foreground">
                <span>Type</span>
                <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as ListingKind | "all")} className="max-w-[9rem] bg-transparent text-[11px] font-bold text-foreground outline-none">
                  <option value="all">All types</option>
                  <option value="product">Products</option>
                  <option value="service">Services</option>
                  <option value="opportunity">Opportunities</option>
                </select>
              </label>
              <label className="flex min-h-9 items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 text-[11px] font-semibold text-muted-foreground">
                <span>Delivery</span>
                <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value as DeliveryMode | "all")} className="max-w-[9rem] bg-transparent text-[11px] font-bold text-foreground outline-none">
                  <option value="all">Any method</option>
                  <option value="meetup">Local meetup</option>
                  <option value="shipping">Shipping</option>
                  <option value="digital">Digital</option>
                  <option value="service">Service / remote</option>
                </select>
              </label>
            </div>
            <label className="flex min-h-9 items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 text-[11px] font-semibold text-muted-foreground">
              <span>Price currency</span>
              <select value={priceCurrency} onChange={(event) => setPriceCurrency(event.target.value as MarketplaceBrowseFilters["priceCurrency"])} className="bg-transparent text-[11px] font-bold text-foreground outline-none">
                <option value="all">All currencies (no numeric range)</option>
                <option value="GHC">GHC</option>
                <option value="PI">Pi</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-semibold text-muted-foreground">Minimum price<input inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0,19))} placeholder="No minimum" className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label>
              <label className="text-[10px] font-semibold text-muted-foreground">Maximum price<input inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0,19))} placeholder="No maximum" className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label>
              <label className="text-[10px] font-semibold text-muted-foreground">Listed from<input type="date" value={browseFrom} max={browseTo || undefined} onChange={(event) => setBrowseFrom(event.target.value)} className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label>
              <label className="text-[10px] font-semibold text-muted-foreground">Listed to<input type="date" value={browseTo} min={browseFrom || undefined} onChange={(event) => setBrowseTo(event.target.value)} className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label>
            </div>
            <p className="text-[10px] text-muted-foreground" role="status" aria-live="polite">{serverBrowseState === "invalid" ? "Choose GHC or Pi before applying a numeric price range; these currencies are never compared as one scale." : serverBrowseState === "loading" ? "Updating server-filtered listings…" : serverBrowseState === "ready" ? (deliveryFilter === "all" ? "Search, category, type, currency-specific price and date filters run on the server before pagination." : "Search, category, type, currency-specific price and date filters run on the server; delivery refines the returned page.") : "Server filtering is temporarily unavailable; showing locally available catalog data."}</p>
            <FilterSummary
              className="mt-2"
              items={[
                ...(query.trim() ? [{ id: "query", label: `Search: ${query.trim()}`, onRemove: () => setQuery("") }] : []),
                ...(category ? [{ id: "category", label: `Category: ${category}`, onRemove: () => setCategory(null) }] : []),
                ...(kindFilter !== "all" ? [{ id: "kind", label: `Type: ${kindFilter}`, onRemove: () => setKindFilter("all") }] : []),
                ...(deliveryFilter !== "all" ? [{ id: "delivery", label: `Delivery: ${deliveryFilter}`, onRemove: () => setDeliveryFilter("all") }] : []),
                ...(minPrice ? [{ id: "min-price", label: `Min: ${minPrice}`, onRemove: () => setMinPrice("") }] : []),
                ...(priceCurrency !== "all" ? [{ id: "price-currency", label: `Currency: ${priceCurrency}`, onRemove: () => setPriceCurrency("all") }] : []),
                ...(maxPrice ? [{ id: "max-price", label: `Max: ${maxPrice}`, onRemove: () => setMaxPrice("") }] : []),
                ...(browseFrom ? [{ id: "from", label: `From: ${browseFrom}`, onRemove: () => setBrowseFrom("") }] : []),
                ...(browseTo ? [{ id: "to", label: `To: ${browseTo}`, onRemove: () => setBrowseTo("") }] : []),
              ]}
              onClearAll={() => { setCategory(null); setKindFilter("all"); setDeliveryFilter("all"); setQuery(""); setMinPrice(""); setMaxPrice(""); setPriceCurrency("all"); setBrowseFrom(""); setBrowseTo("") }}
              ariaLabel="Active marketplace filters"
            />
          </>
        ) : null}
      </header>

      <div className="gh-marketplace-content min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-3">
        {bucket === "browse" ? (
          <div className="mx-auto w-full max-w-[var(--gh-content-max,42rem)]">
            <MarketplaceOutcomeCenter
              orders={outcomeOrders}
              cartCount={cartItems.length}
              savedCount={savedListings.length}
              onOpenCart={() => setBucket("cart")}
              onOpenOrders={() => { setOrderRoleFilter("buying"); setBucket("orders") }}
              onOpenSellerCentre={() => setBucket("mine")}
              onOpenSaved={() => setBucket("saved")}
              onBrowse={() => { setBucket("browse"); setShowCategories(true); requestAnimationFrame(() => searchRef.current?.focus()) }}
            />
          </div>
        ) : null}
        {bucket === "cart" ? (
          <CartPanel
            items={cartItems}
            onChange={(id, quantity, variantId) => {
              const next = updateMarketplaceCartQuantity(id, quantity, variantId)
              setCartItems(next)
              try {
                window.dispatchEvent(new CustomEvent("ghc:marketplace-cart-changed", { detail: { count: next.reduce((n, i) => n + (i.quantity || 0), 0) } }))
              } catch { /* */ }
            }}
            onRemove={(id) => {
              const next = removeMarketplaceCartItem(id)
              setCartItems(next)
              try {
                window.dispatchEvent(new CustomEvent("ghc:marketplace-cart-changed", { detail: { count: next.reduce((n, i) => n + (Number(i.quantity) || 0), 0) } }))
              } catch { /* */ }
            }}
            onClear={() => {
              clearMarketplaceCart()
              setCartItems([])
              try {
                window.dispatchEvent(new CustomEvent("ghc:marketplace-cart-changed", { detail: { count: 0 } }))
              } catch { /* */ }
            }}
            onContinueShopping={() => setBucket("browse")}
          />
        ) : null}
        {bucket === "mine" ? (
          <div className="p-1">
            <div className="mx-auto w-full max-w-[var(--gh-content-max,42rem)]">
              <SellerCommandCenter
                listings={mineListings}
                orders={durableOrders}
                loading={mineLoading || ordersLoading}
                onNewListing={() => { setSellEditId(null); setSellMedia([]); setSellProductOptionsText(""); setSellProductVariantsText(""); setSellAvailability("1"); setBucket("sell") }}
                onOpenOrders={() => { setOrderRoleFilter("selling"); setBucket("orders") }}
              />
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">Your listings</h2>
                  <p className="text-xs text-muted-foreground">
                    Manage the products and services customers can discover in your storefront.
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
              {mineListings.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter your listings">
                  {([
                    ["all", "All", mineListings.length],
                    ["active", "Active", mineListings.filter((listing) => listing.status === "active" && !(listing.kind === "product" && listing.availability <= 0)).length],
                    ["paused", "Paused", mineListings.filter((listing) => listing.status === "paused").length],
                    ["sold_out", "Sold out", mineListings.filter((listing) => listing.status === "sold_out" || (listing.kind === "product" && listing.availability <= 0)).length],
                    ["draft", "Drafts", mineListings.filter((listing) => listing.status === "draft").length],
                  ] as const).map(([id, label, count]) => (
                    <button key={id} type="button" aria-pressed={mineStatusFilter === id} onClick={() => setMineStatusFilter(id)} className={`min-h-9 rounded-full px-3 text-[11px] font-bold transition ${mineStatusFilter === id ? "bg-[var(--gh-green)] text-white" : "border border-border/70 bg-card text-muted-foreground hover:text-foreground"}`}>
                      {label} <span className="ml-1 opacity-80">{count}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {mineLoading ? (
                <LoadingState title="Loading your listings" description="Checking your current storefront from the latest available data." />
              ) : filteredMineListings.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredMineListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onOpen={(id) => setSelectedId(id)} />
                  ))}
                </div>
              ) : mineListings.length > 0 ? (
                <EmptyState title={`No ${mineStatusFilter.replace("_", " ")} listings`} description="Choose another listing status or clear this filter." action={{ label: "Show all listings", onClick: () => setMineStatusFilter("all") }} />
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
            {savedLoading ? <LoadingState title="Loading saved listings" description="Checking your marketplace shortlist." />
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
            availability={sellAvailability}
            setAvailability={setSellAvailability}
            currency={sellCurrency}
            setCurrency={setSellCurrency}
            description={sellDesc}
            setDescription={setSellDesc}
            category={sellCategory}
            setCategory={setSellCategory}
            location={sellLocation}
            setLocation={setSellLocation}
            deliveryMode={sellDeliveryMode}
            setDeliveryMode={setSellDeliveryMode}
            deliveryNotes={sellDeliveryNotes}
            setDeliveryNotes={setSellDeliveryNotes}
            productOptionsText={sellProductOptionsText}
            setProductOptionsText={setSellProductOptionsText}
            productVariantsText={sellProductVariantsText}
            setProductVariantsText={setSellProductVariantsText}
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
              setSellProductOptionsText("")
              setSellProductVariantsText("")
              setSellAvailability("1")
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
              const availabilityNum = sellAvailability.trim() === "" ? Number.NaN : Number(sellAvailability)
              if (!Number.isSafeInteger(availabilityNum) || availabilityNum < 0 || availabilityNum > 9999) {
                setSellError("Enter whole-number stock from 0 to 9,999")
                return
              }
              const productOptions = parseProductOptionsText(sellProductOptionsText)
              if (productOptions === null) {
                setSellError("Check product options: use one 'Name: value, value' line per group, with at most 4 groups and 12 values per group.")
                return
              }
              const parsedVariants = parseProductVariantsText(sellProductVariantsText, sellCurrency)
              if (parsedVariants === null) {
                setSellError("Check SKU variants: use SKU | label | price | whole-number stock, with unique SKUs and at most 100 lines.")
                return
              }
              const productVariants = parsedVariants
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
                    availability: availabilityNum,
                    media: sellMedia.slice(0, 6),
                    location: sellLocation.trim() || undefined,
                    shippingInfo: encodeShippingInfo(sellDeliveryMode, sellDeliveryNotes),
                    productOptions,
                    variants: productVariants,
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
                      availability: availabilityNum,
                      currency: sellCurrency,
                      location: sellLocation.trim() || undefined,
                      shippingInfo: encodeShippingInfo(sellDeliveryMode, sellDeliveryNotes),
                      productOptions,
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
                  setSellAvailability("1")
                  setSellDesc("")
                  setSellLocation("")
                  setSellProductOptionsText("")
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
                    shippingInfo: encodeShippingInfo(sellDeliveryMode, sellDeliveryNotes),
                    productOptions,
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
                        availability: availabilityNum,
                        location: sellLocation.trim() || undefined,
                        shippingInfo: encodeShippingInfo(sellDeliveryMode, sellDeliveryNotes),
                        productOptions,
                        category: sellCategory,
                        media: sellMedia.slice(0, 6),
                      },
                      maxRetries: 3,
                    })
                    // Keep local draft listing for this device; public publish waits for flush
                    setSellTitle("")
                    setSellPrice("")
                    setSellAvailability("1")
                    setSellDesc("")
                    setSellLocation("")
                    setSellProductOptionsText("")
                    setSellProductVariantsText("")
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
                      availability: availabilityNum,
                      media: sellMedia.slice(0, 6),
                      location: sellLocation.trim() || undefined,
                      shippingInfo: encodeShippingInfo(sellDeliveryMode, sellDeliveryNotes),
                      productOptions,
                      variants: productVariants,
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
                setSellProductOptionsText("")
                setSellProductVariantsText("")
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                ["all", "All"],
                ["buying", "Buying"],
                ["selling", "Selling"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOrderRoleFilter(id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    orderRoleFilter === id
                      ? "bg-emerald-700 text-white"
                      : "border border-border/70 bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void loadDurableOrders()}
                className="ml-auto text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
              >
                Refresh
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Track pay → fulfill → deliver → complete. Message opens the order thread when available.
            </p>
          {ordersLoading && orders.length === 0 ? (
            <LoadingState title="Loading orders" description="Checking the latest durable order status." />
          ) : orders.length === 0 ? (
            <EmptyState
              variant="transactions"
              title={
                orderRoleFilter === "buying"
                  ? "No purchases yet"
                  : orderRoleFilter === "selling"
                    ? "No sales yet"
                    : "No orders yet"
              }
              description={
                orderRoleFilter === "buying"
                  ? "When you checkout, buyer orders appear here with live status."
                  : orderRoleFilter === "selling"
                    ? "When someone buys your listing, seller orders appear here to fulfill."
                    : "Purchases and sales appear here from the durable Marketplace order authority."
              }
              icon={Package}
            />
          ) : (
            <ul className="space-y-2.5">
              {orders.map((o) => {
                const viewerId = IdentityService.getCurrentUserId() || ""
                const isSeller = isOwnedByCurrentUser(o.sellerId)
                const status = String(o.status || "created")
                const busy = Boolean(orderBusy)
                const stepIdx = orderLifecycleIndex({
                  status,
                  paymentStatus: o.paymentStatus,
                  deliveryStatus: o.deliveryStatus,
                })
                const nextHint = orderNextActionHint({
                  status,
                  paymentStatus: o.paymentStatus,
                  deliveryStatus: o.deliveryStatus,
                  isSeller,
                })
                return (
                  <li key={o.id} className="rounded-[1.5rem] border border-border/50 bg-card p-4 shadow-[var(--gh-card-shadow)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {isSeller ? "Sale" : "Purchase"} · {o.currency} {Number(o.unitPrice).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          Qty {o.quantity} · {isSeller ? "You are seller" : "You are buyer"}
                        </p>
                        {o.variantSku ? <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{o.variantLabel || "Product variant"} · SKU {o.variantSku}</p> : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        {orderStatusLabel(status)}
                      </span>
                    </div>
                    <ol className="mt-3 flex items-center gap-1" aria-label="Order progress">
                      {ORDER_LIFECYCLE_STEPS.map((step, i) => {
                        const done = i <= stepIdx
                        return (
                          <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                            <span
                              className={`h-1.5 w-full rounded-full ${done ? "bg-emerald-600" : "bg-muted"}`}
                              aria-hidden
                            />
                            <span className={`text-[9px] font-semibold ${done ? "text-emerald-800 dark:text-emerald-300" : "text-muted-foreground"}`}>
                              {step.label}
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                    {(o.paymentStatus || o.deliveryStatus) ? (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Payment: {String(o.paymentStatus || "—").replace(/_/g, " ")}
                        {" · "}
                        Delivery: {String(o.deliveryStatus || "—").replace(/_/g, " ")}
                      </p>
                    ) : null}
                    {o.fulfilmentMethod ? <div className="mt-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px]">
                      <p className="font-bold">{o.fulfilmentMethod === "shipping" ? "Shipment details" : o.fulfilmentMethod === "pickup" ? "Pickup / meetup" : "Digital delivery / service"}</p>
                      {o.shippingCarrier ? <p className="mt-1 text-muted-foreground">Carrier: {o.shippingCarrier}</p> : null}
                      {o.trackingNumber ? <p className="text-muted-foreground">Tracking: <span className="font-semibold text-foreground">{o.trackingNumber}</span></p> : null}
                      {o.trackingUrl ? <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-8 items-center gap-1 font-bold text-emerald-700 underline dark:text-emerald-300">Track shipment <Truck className="h-3 w-3" /></a> : null}
                      {o.estimatedDeliveryAt ? <p className="mt-1 text-muted-foreground">Estimated delivery: {new Date(o.estimatedDeliveryAt).toLocaleDateString()}</p> : null}
                      {o.dispatchedAt ? <p className="text-muted-foreground">Dispatched: {new Date(o.dispatchedAt).toLocaleString()}</p> : null}
                    </div> : null}
                    {nextHint ? (
                      <p className="mt-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">{nextHint}</p>
                    ) : null}
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
                      {isSeller ? <SellerFulfilmentControls order={o} busy={busy} onAction={(action, payload) => void runOrderAction(o.id, action, payload)} /> : null}
                      {!isSeller && status === "fulfilling" && ["delivered","service_active"].includes(String(o.deliveryStatus || "")) ? <button type="button" disabled={busy} onClick={() => void runOrderAction(o.id,"buyer_confirm")} className="min-h-9 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white">Confirm received</button> : null}
                      {!isSeller && status === "completed" ? (
                        <button
                          type="button"
                          disabled={busy || reviewBusy}
                          onClick={() => {
                            setReviewDraftOrderId(o.id)
                            setReviewRating(5)
                            setReviewText("")
                          }}
                          className="min-h-9 rounded-full border border-emerald-600/40 px-3 text-xs font-bold text-emerald-800 dark:text-emerald-300"
                        >
                          Leave review
                        </button>
                      ) : null}
                      {!['completed','cancelled','disputed','refunded'].includes(status) && o.paymentStatus === "verified" ? <button type="button" disabled={busy} onClick={() => void runOrderAction(o.id,"dispute")} className="min-h-9 rounded-full border border-amber-500/50 px-3 text-xs font-bold text-amber-700 dark:text-amber-300">Open dispute</button> : null}
                    </div>
                    <OrderTimelinePanel orderId={o.id} />
                    <p className="mt-2 text-[11px] text-muted-foreground">Updated {new Date(o.updatedAt || o.createdAt).toLocaleString()}</p>
                    {reviewDraftOrderId === o.id ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-emerald-600/25 bg-emerald-50/40 p-3 dark:bg-emerald-950/20">
                        <p className="text-[11px] font-bold text-foreground">Rate this completed order</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setReviewRating(n)}
                              className={`h-8 w-8 rounded-full text-[12px] font-bold ${
                                reviewRating === n
                                  ? "bg-emerald-700 text-white"
                                  : "border border-border bg-card text-muted-foreground"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value.slice(0, 2000))}
                          rows={3}
                          placeholder="What went well? (min 3 characters)"
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px]"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={reviewBusy}
                            onClick={() => {
                              void (async () => {
                                if (reviewText.trim().length < 3) {
                                  window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "Review needs at least 3 characters", type: "error" } }))
                                  return
                                }
                                setReviewBusy(true)
                                try {
                                  const domain = getMarketplaceDomain()
                                  const res = await domain?.submitReview?.({
                                    orderId: o.id,
                                    rating: reviewRating,
                                    text: reviewText.trim(),
                                  })
                                  if (!res || res.ok === false) {
                                    throw new Error((res as { error?: string } | null)?.error || "Review failed")
                                  }
                                  setReviewDraftOrderId(null)
                                  setReviewText("")
                                  window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "Review submitted", type: "success" } }))
                                } catch (e) {
                                  window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: e instanceof Error ? e.message : "Review failed", type: "error" } }))
                                } finally {
                                  setReviewBusy(false)
                                }
                              })()
                            }}
                            className="min-h-9 flex-1 rounded-full bg-emerald-700 text-[12px] font-bold text-white disabled:opacity-60"
                          >
                            {reviewBusy ? "Submitting…" : "Submit review"}
                          </button>
                          <button
                            type="button"
                            disabled={reviewBusy}
                            onClick={() => setReviewDraftOrderId(null)}
                            className="min-h-9 rounded-full border border-border px-3 text-[12px] font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          </div>
        ) : listings.length === 0 && serverBrowseState === "invalid" ? (
          <FilterResultState state="error" title="Choose a price currency" description="Select GHC or Pi before applying a minimum or maximum price. GreenHaven keeps the two currency scales separate." />
        ) : listings.length === 0 && serverBrowseState === "loading" ? (
          <FilterResultState state="loading" description="Searching the server catalog with your selected filters…" />
        ) : listings.length === 0 && serverBrowseState === "unavailable" ? (
          <FilterResultState state="error" title="Server catalog unavailable" description="The server-filtered catalog could not be loaded. Try again or review the locally available catalog." onRetry={refresh} />
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center px-2 pt-6">
            <EmptyState
              variant="search"
              title={hasBrowseFilters ? "No matching listings" : "No listings yet"}
              description={
                hasBrowseFilters
                  ? "Try changing your search, category, listing type or delivery method. Only real seller listings appear here."
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
            {serverBrowseHasMore && browseOffset < 10000 ? <button type="button" onClick={() => setBrowseOffset((value) => value + 50)} className="mt-2 min-h-10 rounded-full border border-border px-4 text-xs font-bold">Load more listings</button> : null}
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-foreground">Discover on GreenHaven</h2>
                <p className="text-[11px] text-muted-foreground" role="status" aria-live="polite">
                  {listings.length} listing{listings.length === 1 ? "" : "s"}
                  {category ? ` · ${category}` : ""}
                  {query.trim() ? ` · “${query.trim()}”` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="gh-market-sort">Sort listings</label>
                <select
                  id="gh-market-sort"
                  value={browseSort}
                  onChange={(e) => setBrowseSort(e.target.value as BrowseSort)}
                  className="h-8 rounded-full border border-border/70 bg-card px-2.5 text-[11px] font-semibold text-foreground"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price · low to high (by currency)</option>
                  <option value="price_desc">Price · high to low (by currency)</option>
                </select>
                <button type="button" onClick={refresh} className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300">
                  Refresh
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3 min-[960px]:grid-cols-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} onOpen={setSelectedId} />
              ))}
            </div>
            {serverBrowseHasMore && browseOffset < 10000 && serverBrowseState === "ready" ? <button type="button" onClick={() => setBrowseOffset((value) => value + 50)} className="mt-3 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Load more listings</button> : null}
          </>
        )}
      </div>
    </div>
  )
}
