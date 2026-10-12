/**
 * POST /api/marketplace/listings — seller registers/updates authoritative listing.
 *
 * Seller product price (body.price) is seller-chosen; server validates and stores it.
 * GreenHaven listing fee is calculated server-side only (never from client).
 * Client fields listingFee / feeAmount / sellerId are ignored.
 *
 * Body: { id?, title, description?, price, currency?, availability?, status?, kind? }
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  upsertListing,
  listingsDurable,
  getListing,
  listActiveListings,
  listSellerListings,
} from "@/lib/server/marketplace/listing-store"
import {
  calculateMarketplaceListingFee,
  listingFeeRequiresSettlement,
} from "@/lib/server/marketplace/listing-fee"
import { verifyListingFeePayment } from "@/lib/server/marketplace/verify-listing-fee-payment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_CURRENCIES = new Set(["GHC", "PI"])
/** Max decimal places for seller price (avoid dust / float abuse) */
const MAX_PRICE_DECIMALS = 8

function decimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 99
  const s = String(n)
  if (s.includes("e") || s.includes("E")) return 99
  const i = s.indexOf(".")
  return i < 0 ? 0 : s.length - i - 1
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rateLimit = checkRateLimit(`marketplace-listing-write:${auth.userId}`, 20, 60_000)
  if (!rateLimit.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rateLimit.retryAfterSec }, { status: 429 })
  if (!listingsDurable()) {
    return NextResponse.json(
      {
        ok: false,
        error: "LISTINGS_REQUIRE_DATABASE",
        message: "Apply marketplace listings migration",
      },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))

  // Never trust client identity or fee fields
  void body.sellerId
  void body.ownerId
  void body.userId
  void body.listingFee
  void body.feeAmount
  void body.fee
  void body.platformFee

  const title = String(body.title || "").trim().slice(0, 200)
  const price = Number(body.price)
  const currency = String(body.currency || "GHC").toUpperCase().slice(0, 8)
  const availability = Math.max(0, Math.min(9999, Math.floor(Number(body.availability) || 1)))
  let status = String(body.status || "draft")
  if (process.env.GH_MARKETPLACE_PAUSED === "1" && status === "active") return NextResponse.json({ ok: false, error: "MARKETPLACE_PAUSED" }, { status: 503 })
  const kind = String(body.kind || "product").slice(0, 64)
  const categories = new Set(["Goods", "Services", "Digital", "Professional", "Community", "Opportunities", "Other"])
  const conditions = new Set(["new", "like_new", "good", "fair", "not_applicable"])
  const category = categories.has(String(body.category || "Other")) ? String(body.category || "Other") : "Other"
  const condition = conditions.has(String(body.condition || "not_applicable")) ? String(body.condition || "not_applicable") : "not_applicable"
  const location = String(body.location || "").trim().slice(0, 120)
  const shippingInfo = String(body.shippingInfo || "").trim().slice(0, 500)
  const allowedDeliveryOptions = new Set(["shipping", "pickup", "local_delivery", "digital", "remote_service"])
  const deliveryOptions = Array.isArray(body.deliveryOptions) ? [...new Set(body.deliveryOptions.map((option: unknown) => String(option).trim()).filter((option: string) => allowedDeliveryOptions.has(option)))] : []
  const tags = Array.isArray(body.tags) ? body.tags.map((tag: unknown) => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 20) : []
  const id =
    String(body.id || "").trim() ||
    `lst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  if (!title) {
    return NextResponse.json({ ok: false, error: "TITLE_REQUIRED" }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    return NextResponse.json({ ok: false, error: "INVALID_PRICE" }, { status: 400 })
  }
  const allowedPriceDecimals = currency === "GHC" ? 4 : MAX_PRICE_DECIMALS
  if (decimalPlaces(price) > allowedPriceDecimals) {
    return NextResponse.json(
      { ok: false, error: "PRICE_PRECISION", maxDecimals: allowedPriceDecimals, currency },
      { status: 400 }
    )
  }
  if (!ALLOWED_CURRENCIES.has(currency)) {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_CURRENCY", allowed: [...ALLOWED_CURRENCIES] },
      { status: 400 }
    )
  }
  if (!["draft", "active", "paused", "sold_out", "removed"].includes(status)) {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 })
  }

  // Ownership: updates only by original seller (SQL also enforces; check early for clear 403)
  const existing = await getListing(id)
  if (existing && existing.sellerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  // Server listing fee (display + gate). Never accept client fee.
  const listingFee = calculateMarketplaceListingFee({
    sellerPrice: price,
    currency,
    kind,
  })

  // Non-zero approved listing fee: activation requires verified durable payment intent.
  // Client may supply listingFeePaymentId / feePaymentId; ownership, amount, status,
  // purpose, and listing binding come only from server intent records.
  // Zero-fee / rates not configured: leave status as seller requested (incl. active).
  void body.feePaid
  void body.feeAmount
  void body.listingFee
  if (listingFeeRequiresSettlement(listingFee) && status === "active") {
    const feePaymentRef = String(body.listingFeePaymentId || body.feePaymentId || "").trim()
    const verified = await verifyListingFeePayment({
      sellerId: auth.userId,
      listingId: id,
      fee: listingFee,
      paymentRef: feePaymentRef || null,
    })
    if (!verified.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: verified.error,
          message:
            "Listing fee payment must be a completed intent owned by you, matching the server fee amount/currency, and bound to this listing (referenceId marketplace_listing_fee_{listingId} or metadata.listingId).",
          listingFee: {
            amount: listingFee.feeAmount,
            currency: listingFee.feeCurrency,
            ratesApproved: listingFee.ratesApproved,
            code: listingFee.code,
          },
          expectedReferenceId: `marketplace_listing_fee_${id}`,
        },
        { status: verified.error === "LISTING_FEE_PAYMENT_REQUIRED" ? 402 : 403 }
      )
    }
  }

  const saved = await upsertListing({
    id,
    sellerId: auth.userId,
    title,
    description: String(body.description || "").slice(0, 4000),
    price,
    currency,
    availability,
    status: status as "draft" | "active" | "paused" | "sold_out" | "removed",
    kind,
    metadata: {
      category: body.category == null ? String(existing?.metadata?.category || category) : category,
      condition: body.condition == null ? String(existing?.metadata?.condition || condition) : condition,
      location: body.location == null ? String(existing?.metadata?.location || location) : location,
      shippingInfo: body.shippingInfo == null ? String(existing?.metadata?.shippingInfo || shippingInfo) : shippingInfo,
      deliveryOptions: body.deliveryOptions == null && Array.isArray(existing?.metadata?.deliveryOptions) ? existing.metadata.deliveryOptions : deliveryOptions,
      tags: body.tags == null && Array.isArray(existing?.metadata?.tags) ? existing.metadata.tags : tags,
    },
  })
  if (!saved.ok) {
    const durable =
      String(saved.error || "").includes("DATABASE") ||
      String(saved.error || "").includes("UPSERT") ||
      String(saved.error || "").includes("DURABLE") ||
      String(saved.error || "").includes("FORBIDDEN")
    const statusCode =
      String(saved.error || "").includes("FORBIDDEN") ||
      String(saved.error || "").toLowerCase().includes("owner")
        ? 403
        : durable
          ? 503
          : 400
    return NextResponse.json({ ok: false, error: saved.error }, { status: statusCode })
  }

  return NextResponse.json({
    ok: true,
    listing: {
      id,
      sellerId: auth.userId,
      title,
      price,
      currency,
      availability,
      status,
      kind,
      category,
      condition,
      location,
      shippingInfo,
      deliveryOptions,
      tags,
    },
    /** Platform service charge — distinct from seller product price */
    listingFee: {
      amount: listingFee.feeAmount,
      currency: listingFee.feeCurrency,
      ratesApproved: listingFee.ratesApproved,
      code: listingFee.code,
      requiresSettlement: listingFeeRequiresSettlement(listingFee),
    },
  })
}


/** GET /api/marketplace/listings?scope=public|mine&limit=50&id= */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  const scope = (url.searchParams.get("scope") || "public").toLowerCase()
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100)

  if (id) {
    const listing = await getListing(id)
    if (!listing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }
    // Hide non-active from public viewers; seller can still load own via scope=mine
    if (listing.status !== "active") {
      const auth = await resolveAuthenticatedUser(request.headers)
      if (!auth || auth.userId !== listing.sellerId) {
        return NextResponse.json(
          { ok: false, error: "NOT_FOUND" },
          { status: 404, headers: { "Cache-Control": "no-store" } }
        )
      }
    }
    return NextResponse.json(
      { ok: true, durable: listingsDurable(), listing },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  if (scope === "mine") {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const listings = await listSellerListings(auth.userId, limit)
    return NextResponse.json(
      { ok: true, durable: listingsDurable(), listings },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const query = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80)
  const category = String(url.searchParams.get("category") || "").trim()
  const conditionFilter = String(url.searchParams.get("condition") || "").trim()
  const locationFilter = String(url.searchParams.get("location") || "").trim().toLowerCase().slice(0, 120)
  const deliveryFilter = String(url.searchParams.get("deliveryOption") || "").trim()
  const kindFilter = String(url.searchParams.get("kind") || "").trim()
  const currencyFilter = String(url.searchParams.get("currency") || "").trim().toUpperCase()
  const minPrice = url.searchParams.has("minPrice") ? Number(url.searchParams.get("minPrice")) : null
  const maxPrice = url.searchParams.has("maxPrice") ? Number(url.searchParams.get("maxPrice")) : null
  const availableOnly = url.searchParams.get("availableOnly") === "true"
  let listings = await listActiveListings(100)
  listings = listings.filter((listing) => {
    const meta = listing.metadata || {}
    if (query && !`${listing.title} ${listing.description || ""} ${Array.isArray(meta.tags) ? meta.tags.join(" ") : ""}`.toLowerCase().includes(query)) return false
    if (category && String(meta.category || "Other") !== category) return false
    if (conditionFilter && String(meta.condition || "not_applicable") !== conditionFilter) return false
    if (locationFilter && !String(meta.location || "").toLowerCase().includes(locationFilter)) return false
    if (deliveryFilter && !(Array.isArray(meta.deliveryOptions) && meta.deliveryOptions.includes(deliveryFilter))) return false
    if (kindFilter && listing.kind !== kindFilter) return false
    if (currencyFilter && listing.currency.toUpperCase() !== currencyFilter) return false
    if (minPrice != null && Number.isFinite(minPrice) && listing.price < minPrice) return false
    if (maxPrice != null && Number.isFinite(maxPrice) && listing.price > maxPrice) return false
    if (availableOnly && listing.availability <= 0) return false
    return true
  }).slice(0, limit)
  return NextResponse.json(
    { ok: true, durable: listingsDurable(), listings, facets: { categories: [...new Set(listings.map((l) => String(l.metadata?.category || "Other")))], conditions: [...new Set(listings.map((l) => String(l.metadata?.condition || "not_applicable")))], deliveryOptions: [...new Set(listings.flatMap((l) => Array.isArray(l.metadata?.deliveryOptions) ? l.metadata.deliveryOptions.map(String) : []))], currencies: [...new Set(listings.map((l) => l.currency))] } },
    { headers: { "Cache-Control": "no-store" } }
  )
}
