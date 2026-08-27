/**
 * MarketplaceDomain — products, services, orders, reviews, promotions.
 *
 * Integrated with Profile, Reputation, Verification, Membership, Wallet, Notifications.
 * Not a separate app identity — sellers are GH Connect profiles.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { domainEvents } from "../realtime/event-bus"
import type { DomainServices } from "./create-domains"

export type ListingKind = "product" | "service" | "opportunity"
export type ListingStatus =
  | "draft"
  | "active"
  | "paused"
  | "sold_out"
  | "expired"
  | "removed"
  | "under_review"

export type ListingCondition = "new" | "like_new" | "good" | "fair" | "not_applicable"

export type OrderStatus =
  | "created"
  | "pending"
  | "confirmed"
  | "processing"
  | "fulfilled"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded"

export type PromotionKind = "featured" | "priority" | "boost"

export interface MarketplaceListing {
  id: string
  kind: ListingKind
  title: string
  description: string
  media: string[]
  category: string
  tags?: string[]
  price: number
  /** Display currency label — GHC utility or external label (not auto on-chain) */
  currency: string
  condition: ListingCondition
  location?: string
  shippingInfo?: string
  sellerId: string
  availability: number
  status: ListingStatus
  createdAt: number
  updatedAt: number
  promotedUntil?: number
  promotionKind?: PromotionKind
}

export interface MarketplaceOrder {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  quantity: number
  unitPrice: number
  currency: string
  status: OrderStatus
  createdAt: number
  updatedAt: number
  confirmedAt?: number
  fulfilledAt?: number
  completedAt?: number
  cancelledAt?: number
  notes?: string
  /** Payment is separate — never auto-complete on payment request alone */
  paymentStatus?: "none" | "requested" | "held" | "captured" | "refunded"
}

export interface MarketplaceReview {
  id: string
  orderId: string
  listingId: string
  reviewerId: string
  sellerId: string
  rating: number
  text: string
  createdAt: number
}

export interface MarketplacePromotion {
  id: string
  listingId: string
  sellerId: string
  kind: PromotionKind
  durationMs: number
  priceGhc: number
  startedAt: number
  endsAt: number
  txId?: string
}

export interface SellerProfileView {
  sellerId: string
  displayName?: string
  photo?: string
  verificationLabels: string[]
  identityVerified: boolean
  reputationScore: number
  reputationTier: string
  reviewCount: number
  averageRating: number
  completedOrders: number
  activeListings: number
  responseHint?: string
}

const LISTINGS_KEY = "ghc_marketplace_listings_v1"
const ORDERS_KEY = "ghc_marketplace_orders_v1"
const REVIEWS_KEY = "ghc_marketplace_reviews_v1"
const FAVS_KEY = "ghc_marketplace_favorites_v1"
const PROMO_KEY = "ghc_marketplace_promos_v1"

/** Configurable promotion catalog */
export const PROMOTION_CATALOG: Record<
  PromotionKind,
  { label: string; durationMs: number; priceGhc: number }
> = {
  boost: { label: "Boost 24h", durationMs: 24 * 3600_000, priceGhc: 25 },
  priority: { label: "Priority 3d", durationMs: 3 * 24 * 3600_000, priceGhc: 60 },
  featured: { label: "Featured 7d", durationMs: 7 * 24 * 3600_000, priceGhc: 120 },
}

export const MARKETPLACE_CATEGORIES = [
  "Goods",
  "Services",
  "Digital",
  "Professional",
  "Community",
  "Opportunities",
  "Other",
] as const

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* */
  }
}

function validateListingInput(input: {
  title?: string
  description?: string
  price?: number
  media?: string[]
  category?: string
}): string | null {
  if (!input.title?.trim() || input.title.trim().length < 3) return "Title too short"
  if (input.title.length > 120) return "Title too long"
  if (!input.description?.trim() || input.description.trim().length < 10) {
    return "Description too short"
  }
  if (input.description.length > 5000) return "Description too long"
  if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) {
    return "Invalid price"
  }
  if (input.media && input.media.length > 12) return "Too many media items"
  if (!input.category?.trim()) return "Category required"
  return null
}

export function createMarketplaceDomain(deps: {
  currentUserId?: string
  /** Resolve live services for profile/reputation/verification/membership/economy */
  getServices?: () => DomainServices | null
}) {
  const userId = deps.currentUserId || "current-user"

  function listings(): MarketplaceListing[] {
    return loadJSON<MarketplaceListing[]>(LISTINGS_KEY, [])
  }
  function saveListings(list: MarketplaceListing[]) {
    saveJSON(LISTINGS_KEY, list.slice(-500))
  }
  function orders(): MarketplaceOrder[] {
    return loadJSON<MarketplaceOrder[]>(ORDERS_KEY, [])
  }
  function saveOrders(list: MarketplaceOrder[]) {
    saveJSON(ORDERS_KEY, list.slice(-500))
  }
  function reviews(): MarketplaceReview[] {
    return loadJSON<MarketplaceReview[]>(REVIEWS_KEY, [])
  }
  function saveReviews(list: MarketplaceReview[]) {
    saveJSON(REVIEWS_KEY, list.slice(-500))
  }
  function favorites(): string[] {
    const all = loadJSON<Record<string, string[]>>(FAVS_KEY, {})
    return all[userId] || []
  }
  function saveFavorites(ids: string[]) {
    const all = loadJSON<Record<string, string[]>>(FAVS_KEY, {})
    all[userId] = ids
    saveJSON(FAVS_KEY, all)
  }

  return {
    getCategories: () => [...MARKETPLACE_CATEGORIES],

    // ── Listings ──────────────────────────────────────────────────────

    listListings(filter?: {
      category?: string
      sellerId?: string
      status?: ListingStatus
      kind?: ListingKind
      query?: string
      includeExpiredPromos?: boolean
    }): MarketplaceListing[] {
      const now = Date.now()
      let list = listings().filter((l) => l.status !== "removed")
      if (filter?.category) list = list.filter((l) => l.category === filter.category)
      if (filter?.sellerId) list = list.filter((l) => l.sellerId === filter.sellerId)
      if (filter?.status) list = list.filter((l) => l.status === filter.status)
      else list = list.filter((l) => l.status === "active" || l.status === "sold_out")
      if (filter?.kind) list = list.filter((l) => l.kind === filter.kind)
      if (filter?.query) {
        const q = filter.query.toLowerCase()
        list = list.filter(
          (l) =>
            l.title.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q) ||
            (l.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      }
      // Featured/priority first while promo active
      list.sort((a, b) => {
        const ap = a.promotedUntil && a.promotedUntil > now ? 1 : 0
        const bp = b.promotedUntil && b.promotedUntil > now ? 1 : 0
        if (ap !== bp) return bp - ap
        if (a.promotionKind === "featured" && b.promotionKind !== "featured") return -1
        if (b.promotionKind === "featured" && a.promotionKind !== "featured") return 1
        return b.updatedAt - a.updatedAt
      })
      return list
    },

    getListing(id: string): MarketplaceListing | undefined {
      return listings().find((l) => l.id === id)
    },

    async createListing(input: {
      kind: ListingKind
      title: string
      description: string
      media?: string[]
      category: string
      tags?: string[]
      price: number
      currency?: string
      condition?: ListingCondition
      location?: string
      shippingInfo?: string
      availability?: number
      status?: ListingStatus
    }): Promise<MutationResult<{ listing: MarketplaceListing }>> {
      return runMutation({
        name: "marketplace.createListing",
        actorId: userId,
        input,
        validate: (i) => validateListingInput(i),
        mutate: (i) => {
          const listing: MarketplaceListing = {
            id: genId("lst"),
            kind: i.kind,
            title: i.title.trim(),
            description: i.description.trim(),
            media: (i.media || []).slice(0, 12),
            category: i.category.trim(),
            tags: i.tags,
            price: i.price,
            currency: i.currency || "GHC",
            condition: i.condition || (i.kind === "service" ? "not_applicable" : "new"),
            location: i.location,
            shippingInfo: i.shippingInfo,
            sellerId: userId,
            availability: i.availability ?? 1,
            status: i.status || "active",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          const list = listings()
          list.unshift(listing)
          saveListings(list)
          domainEvents.publish(
            "MARKETPLACE_LISTING_CREATED",
            { listingId: listing.id },
            userId,
            listing.id
          )
          return { listing }
        },
      })
    },

    async updateListing(
      id: string,
      patch: Partial<
        Pick<
          MarketplaceListing,
          | "title"
          | "description"
          | "media"
          | "category"
          | "tags"
          | "price"
          | "currency"
          | "condition"
          | "location"
          | "shippingInfo"
          | "availability"
          | "status"
        >
      >
    ): Promise<MutationResult<{ listing: MarketplaceListing }>> {
      return runMutation({
        name: "marketplace.updateListing",
        actorId: userId,
        input: { id, patch },
        validate: (i) => {
          const existing = listings().find((l) => l.id === i.id)
          if (!existing) return "Listing not found"
          if (existing.sellerId !== userId) return "Not your listing"
          return validateListingInput({ ...existing, ...i.patch })
        },
        mutate: (i) => {
          const list = listings()
          const idx = list.findIndex((l) => l.id === i.id)
          const next = {
            ...list[idx],
            ...i.patch,
            updatedAt: Date.now(),
          }
          list[idx] = next
          saveListings(list)
          domainEvents.publish(
            "MARKETPLACE_LISTING_UPDATED",
            { listingId: next.id },
            userId,
            next.id
          )
          return { listing: next }
        },
      })
    },

    // ── Seller profile (canonical Profile + Reputation + Verification) ─

    getSellerProfile(sellerId: string): SellerProfileView {
      const services = deps.getServices?.()
      const sellerListings = listings().filter(
        (l) => l.sellerId === sellerId && (l.status === "active" || l.status === "sold_out")
      )
      const sellerOrders = orders().filter(
        (o) => o.sellerId === sellerId && o.status === "completed"
      )
      const sellerReviews = reviews().filter((r) => r.sellerId === sellerId)
      const avg =
        sellerReviews.length > 0
          ? sellerReviews.reduce((s, r) => s + r.rating, 0) / sellerReviews.length
          : 0

      const rep = services?.reputation?.getSnapshot?.(sellerId)
      const ver = services?.verification?.getSnapshot?.(sellerId)
      const peer = services?.profile?.getPeerIdentity?.({ userId: sellerId })

      return {
        sellerId,
        displayName: peer?.profile?.displayName,
        photo: peer?.profile?.photos?.[0],
        verificationLabels: ver?.anyVerified
          ? services?.verification?.getLabels?.(sellerId) || []
          : [],
        identityVerified: Boolean(ver?.identityVerified),
        reputationScore: rep?.score ?? 0,
        reputationTier: rep?.tier ?? "new",
        reviewCount: sellerReviews.length,
        averageRating: Math.round(avg * 10) / 10,
        completedOrders: sellerOrders.length,
        activeListings: sellerListings.filter((l) => l.status === "active").length,
        responseHint: sellerOrders.length > 5 ? "Usually responds quickly" : undefined,
      }
    },

    getSellerDashboard() {
      const mine = listings().filter((l) => l.sellerId === userId)
      const myOrders = orders().filter((o) => o.sellerId === userId)
      return {
        listings: mine,
        activeCount: mine.filter((l) => l.status === "active").length,
        orders: myOrders,
        openOrders: myOrders.filter((o) =>
          ["created", "pending", "confirmed", "processing", "fulfilled"].includes(o.status)
        ),
        completedCount: myOrders.filter((o) => o.status === "completed").length,
        reviews: reviews().filter((r) => r.sellerId === userId),
        favoritesReceived: 0,
      }
    },

    // ── Favorites ─────────────────────────────────────────────────────

    getFavorites(): MarketplaceListing[] {
      const ids = new Set(favorites())
      return listings().filter((l) => ids.has(l.id))
    },

    toggleFavorite(listingId: string): string[] {
      const ids = favorites()
      const next = ids.includes(listingId)
        ? ids.filter((id) => id !== listingId)
        : [...ids, listingId]
      saveFavorites(next)
      return next
    },

    // ── Orders lifecycle ──────────────────────────────────────────────

    getOrders(role: "buyer" | "seller" | "all" = "all"): MarketplaceOrder[] {
      const all = orders()
      if (role === "buyer") return all.filter((o) => o.buyerId === userId)
      if (role === "seller") return all.filter((o) => o.sellerId === userId)
      return all.filter((o) => o.buyerId === userId || o.sellerId === userId)
    },

    getOrder(id: string): MarketplaceOrder | undefined {
      return orders().find((o) => o.id === id)
    },

    async createOrder(input: {
      listingId: string
      quantity?: number
      notes?: string
    }): Promise<MutationResult<{ order: MarketplaceOrder }>> {
      return runMutation({
        name: "marketplace.createOrder",
        actorId: userId,
        input,
        validate: (i) => {
          const listing = listings().find((l) => l.id === i.listingId)
          if (!listing || listing.status !== "active") return "Listing not available"
          if (listing.sellerId === userId) return "Cannot buy your own listing"
          const qty = i.quantity ?? 1
          if (qty < 1 || qty > listing.availability) return "Invalid quantity"
          return null
        },
        mutate: (i) => {
          const listing = listings().find((l) => l.id === i.listingId)!
          const qty = i.quantity ?? 1
          const order: MarketplaceOrder = {
            id: genId("ord"),
            listingId: listing.id,
            buyerId: userId,
            sellerId: listing.sellerId,
            quantity: qty,
            unitPrice: listing.price,
            currency: listing.currency,
            status: "created",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            notes: i.notes,
            paymentStatus: "none",
          }
          const olist = orders()
          olist.unshift(order)
          saveOrders(olist)
          domainEvents.publish(
            "MARKETPLACE_ORDER_CREATED",
            { orderId: order.id, listingId: listing.id },
            userId,
            order.id
          )
          return { order }
        },
      })
    },

    async transitionOrder(
      orderId: string,
      next: OrderStatus,
      meta?: { paymentStatus?: MarketplaceOrder["paymentStatus"] }
    ): Promise<MutationResult<{ order: MarketplaceOrder }>> {
      return runMutation({
        name: "marketplace.transitionOrder",
        actorId: userId,
        input: { orderId, next, meta },
        validate: (i) => {
          const order = orders().find((o) => o.id === i.orderId)
          if (!order) return "Order not found"
          if (order.buyerId !== userId && order.sellerId !== userId) return "Not a party to this order"
          const allowed = allowedTransitions(order.status)
          if (!allowed.includes(i.next)) {
            return `Cannot move from ${order.status} to ${i.next}`
          }
          // Safety: completed only from fulfilled (not from payment request alone)
          if (i.next === "completed" && order.status !== "fulfilled") {
            return "Order must be fulfilled before completion"
          }
          if (i.next === "confirmed" && order.sellerId !== userId) {
            return "Only seller can confirm"
          }
          if (i.next === "fulfilled" && order.sellerId !== userId) {
            return "Only seller can mark fulfilled"
          }
          if (i.next === "completed" && order.buyerId !== userId && order.sellerId !== userId) {
            return "Not allowed"
          }
          return null
        },
        mutate: (i) => {
          const olist = orders()
          const idx = olist.findIndex((o) => o.id === i.orderId)
          const order = { ...olist[idx] }
          order.status = i.next
          order.updatedAt = Date.now()
          if (i.meta?.paymentStatus) order.paymentStatus = i.meta.paymentStatus
          if (i.next === "confirmed") order.confirmedAt = Date.now()
          if (i.next === "fulfilled") order.fulfilledAt = Date.now()
          if (i.next === "completed") order.completedAt = Date.now()
          if (i.next === "cancelled") order.cancelledAt = Date.now()
          olist[idx] = order
          saveOrders(olist)

          // Inventory on confirm
          if (i.next === "confirmed") {
            const llist = listings()
            const li = llist.findIndex((l) => l.id === order.listingId)
            if (li >= 0) {
              const avail = Math.max(0, llist[li].availability - order.quantity)
              llist[li] = {
                ...llist[li],
                availability: avail,
                status: avail === 0 ? "sold_out" : llist[li].status,
                updatedAt: Date.now(),
              }
              saveListings(llist)
            }
          }

          const eventType =
            i.next === "completed" ? "MARKETPLACE_ORDER_COMPLETED" : "MARKETPLACE_ORDER_UPDATED"
          domainEvents.publish(
            eventType,
            { orderId: order.id, status: order.status, listingId: order.listingId },
            userId,
            order.id
          )

          // Reputation on completed sale (seller)
          if (i.next === "completed") {
            const services = deps.getServices?.()
            void services?.reputation?.recordSignal?.({
              kind: "marketplace_transaction",
              reason: "Completed marketplace order",
              sourceEvent: "MARKETPLACE_ORDER_COMPLETED",
              referenceId: order.id,
              targetUserId: order.sellerId,
            })
          }

          return { order }
        },
      })
    },

    // ── Reviews (completed orders only) ───────────────────────────────

    getReviewsForSeller(sellerId: string): MarketplaceReview[] {
      return reviews().filter((r) => r.sellerId === sellerId)
    },

    async submitReview(input: {
      orderId: string
      rating: number
      text: string
    }): Promise<MutationResult<{ review: MarketplaceReview }>> {
      return runMutation({
        name: "marketplace.submitReview",
        actorId: userId,
        input,
        validate: (i) => {
          const order = orders().find((o) => o.id === i.orderId)
          if (!order) return "Order not found"
          if (order.buyerId !== userId) return "Only the buyer can review"
          if (order.status !== "completed") return "Order must be completed"
          if (order.sellerId === userId) return "Self-review not allowed"
          if (i.rating < 1 || i.rating > 5) return "Rating must be 1–5"
          if (!i.text?.trim() || i.text.trim().length < 3) return "Review text required"
          if (reviews().some((r) => r.orderId === i.orderId)) return "Already reviewed"
          return null
        },
        mutate: (i) => {
          const order = orders().find((o) => o.id === i.orderId)!
          const review: MarketplaceReview = {
            id: genId("rev"),
            orderId: order.id,
            listingId: order.listingId,
            reviewerId: userId,
            sellerId: order.sellerId,
            rating: i.rating,
            text: i.text.trim().slice(0, 2000),
            createdAt: Date.now(),
          }
          const rlist = reviews()
          rlist.unshift(review)
          saveReviews(rlist)

          // Bounded reputation from reviews (anti-exploit: small delta, one per order)
          const services = deps.getServices?.()
          const delta = i.rating >= 4 ? 3 : i.rating <= 2 ? -2 : 1
          void services?.reputation?.recordSignal?.({
            kind: "seller_review",
            reason: `Order review ${i.rating}/5`,
            sourceEvent: "MARKETPLACE_REVIEW",
            referenceId: review.id,
            targetUserId: order.sellerId,
            deltaOverride: delta,
          })

          return { review }
        },
      })
    },

    // ── Promotions ────────────────────────────────────────────────────

    getPromotionCatalog() {
      return { ...PROMOTION_CATALOG }
    },

    async promoteListing(
      listingId: string,
      kind: PromotionKind
    ): Promise<MutationResult<{ listing: MarketplaceListing; promotion: MarketplacePromotion }>> {
      return runMutation({
        name: "marketplace.promoteListing",
        actorId: userId,
        input: { listingId, kind },
        validate: (i) => {
          const listing = listings().find((l) => l.id === i.listingId)
          if (!listing) return "Listing not found"
          if (listing.sellerId !== userId) return "Not your listing"
          if (listing.status !== "active") return "Only active listings can be promoted"
          // Safety/moderation: under_review cannot promote
          return null
        },
        mutate: async (i) => {
          const services = deps.getServices?.()
          const catalog = PROMOTION_CATALOG[i.kind]
          let price = catalog.priceGhc
          // VIP/VVIP soft discount via membership limits (not free unlimited boosts)
          const limits = services?.membership?.getLimits?.()
          if (limits && limits.platformFeeDiscountPct > 0) {
            price = Math.max(1, Math.round(price * (1 - limits.platformFeeDiscountPct / 100)))
          }
          // Free daily boost entitlement (membership)
          let txId: string | undefined
          const hasBoostEntitlement =
            services?.membership?.hasEntitlement?.("boost_post") ||
            services?.membership?.hasEntitlement?.("marketplace_enhanced_visibility")

          if (price > 0) {
            if (!services?.economy?.spend) throw new Error("Wallet unavailable")
            const spent = await services.economy.spend({
              amount: price,
              reason: `Listing promotion ${i.kind}`,
              sourceEvent: "MARKETPLACE_SPEND",
              referenceId: i.listingId,
            })
            if (!spent.ok) throw new Error(spent.error || "Promotion payment failed")
            txId = spent.data?.tx?.id
          } else if (!hasBoostEntitlement) {
            throw new Error("Promotion requires GHC or VIP benefits")
          }

          const now = Date.now()
          const promotion: MarketplacePromotion = {
            id: genId("promo"),
            listingId: i.listingId,
            sellerId: userId,
            kind: i.kind,
            durationMs: catalog.durationMs,
            priceGhc: price,
            startedAt: now,
            endsAt: now + catalog.durationMs,
            txId,
          }
          const promos = loadJSON<MarketplacePromotion[]>(PROMO_KEY, [])
          promos.unshift(promotion)
          saveJSON(PROMO_KEY, promos.slice(-200))

          const llist = listings()
          const idx = llist.findIndex((l) => l.id === i.listingId)
          const listing = {
            ...llist[idx],
            promotedUntil: promotion.endsAt,
            promotionKind: i.kind,
            updatedAt: now,
          }
          llist[idx] = listing
          saveListings(llist)
          domainEvents.publish(
            "MARKETPLACE_LISTING_UPDATED",
            { listingId: listing.id, promotion: i.kind },
            userId,
            listing.id
          )
          return { listing, promotion }
        },
      })
    },

    /**
     * Share listing into Feed as social content — stores listingId reference only.
     * Does not duplicate listing payload into the post body as source of truth.
     */
    async shareListingToFeed(input: {
      listingId: string
      caption?: string
    }): Promise<MutationResult<{ postId: string; listingId: string }>> {
      return runMutation({
        name: "marketplace.shareListingToFeed",
        actorId: userId,
        input,
        validate: (i) => {
          const listing = listings().find((l) => l.id === i.listingId)
          if (!listing) return "Listing not found"
          if (listing.status !== "active") return "Only active listings can be shared"
          if (listing.sellerId !== userId) return "Only the seller can share this listing to Feed"
          return null
        },
        mutate: async (i) => {
          const listing = listings().find((l) => l.id === i.listingId)!
          const services = deps.getServices?.()
          if (!services?.posts?.createPost) {
            throw new Error("Feed post domain unavailable")
          }
          const caption =
            (i.caption || "").trim() ||
            `${listing.title} — ${listing.price} ${listing.currency}`
          const result = await services.posts.createPost({
            content: caption,
            images: (listing.media || []).slice(0, 4),
            visibility: "public",
            listingId: listing.id,
            listingKind: listing.kind,
            contentType: "marketplace_listing",
          })
          if (!result.ok || !result.data) {
            throw new Error(result.error || "Failed to create feed post")
          }
          const post = result.data
          domainEvents.publish(
            "MARKETPLACE_LISTING_SHARED",
            { listingId: listing.id, postId: post.id, surface: "feed" },
            userId,
            listing.id
          )
          return { postId: post.id, listingId: listing.id }
        },
      })
    },

    /**
     * Share listing into a community conversation/context.
     * Listing data stays canonical; community only holds a reference message.
     */
    async shareListingToCommunity(input: {
      listingId: string
      communityId: string
      caption?: string
    }): Promise<MutationResult<{ conversationId: string; listingId: string }>> {
      return runMutation({
        name: "marketplace.shareListingToCommunity",
        actorId: userId,
        input,
        validate: (i) => {
          const listing = listings().find((l) => l.id === i.listingId)
          if (!listing) return "Listing not found"
          if (listing.status !== "active") return "Only active listings can be shared"
          if (!i.communityId) return "Community required"
          return null
        },
        mutate: async (i) => {
          const listing = listings().find((l) => l.id === i.listingId)!
          const services = deps.getServices?.()
          if (!services?.messaging?.sendMessage) {
            throw new Error("Messaging domain unavailable")
          }
          const text =
            (i.caption || "").trim() ||
            `Marketplace: ${listing.title} (${listing.price} ${listing.currency})`
          const sent = await services.messaging.sendMessage({
            conversationId: i.communityId,
            text: `${text}\n[listing:${listing.id}]`,
            metadata: {
              kind: "marketplace_listing",
              listingId: listing.id,
            },
          } as any)
          if (!sent.ok) {
            throw new Error(sent.error || "Failed to share into community")
          }
          domainEvents.publish(
            "MARKETPLACE_LISTING_SHARED",
            {
              listingId: listing.id,
              communityId: i.communityId,
              surface: "community",
            },
            userId,
            listing.id
          )
          return { conversationId: i.communityId, listingId: listing.id }
        },
      })
    },

    /** Resolve canonical listing from a feed post or message reference */
    resolveListingFromRef(listingId: string): MarketplaceListing | undefined {
      return listings().find((l) => l.id === listingId && l.status !== "removed")
    },

    search(query: string, limit = 30): MarketplaceListing[] {
      return this.listListings({ query, status: "active" }).slice(0, limit)
    },
  }
}

function allowedTransitions(from: OrderStatus): OrderStatus[] {
  switch (from) {
    case "created":
      return ["pending", "cancelled"]
    case "pending":
      return ["confirmed", "cancelled"]
    case "confirmed":
      return ["processing", "cancelled", "disputed"]
    case "processing":
      return ["fulfilled", "cancelled", "disputed"]
    case "fulfilled":
      return ["completed", "disputed"]
    case "completed":
      return ["disputed", "refunded"]
    case "cancelled":
      return []
    case "disputed":
      return ["refunded", "completed", "cancelled"]
    case "refunded":
      return []
    default:
      return []
  }
}

export type MarketplaceDomain = ReturnType<typeof createMarketplaceDomain>
