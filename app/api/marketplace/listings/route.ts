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
import {
  upsertListing,
  upsertListingWithVariants,
  listingsDurable,
  getListing,
  listActiveListings,
  listSellerListings,
  serverListingToClient,
} from "@/lib/server/marketplace/listing-store"
import {
  calculateMarketplaceListingFee,
  listingFeeRequiresSettlement,
} from "@/lib/server/marketplace/listing-fee"
import { verifyListingFeePayment } from "@/lib/server/marketplace/verify-listing-fee-payment"
import { settlePilotFee } from "@/lib/server/fees/settle-pilot-fee"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { parseMarketplaceAvailability } from "@/lib/marketplace/checkout-contract"
import { normalizeProductOptions } from "@/lib/marketplace/product-options"
import { normalizeProductVariants } from "@/lib/marketplace/product-variants"
import { parseFilterQuery } from "@/lib/filtering/filter-contract"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"

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
  const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "marketplace/listings:POST", 12, 60_000, { failClosed: true })
  if (__rateLimited) return __rateLimited
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

  const parsedBody = await readBoundedJson(request, 12 * 1024 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value

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
  let status = String(body.status || "draft")
  const kind = String(body.kind || "product").slice(0, 64)
  const location = String(body.location || "").trim().slice(0, 120)
  const shippingInfo = typeof body.shippingInfo === "string" ? body.shippingInfo.trim().slice(0, 240) : ""
  const category = String(body.category || body.cat || "Goods").trim().slice(0, 64)
  const condition = String(body.condition || "not_applicable").trim().slice(0, 32)
  const media = Array.isArray(body.media)
    ? body.media.map((m: unknown) => String(m || "").trim()).filter(Boolean).slice(0, 12)
    : []
  const tags = Array.isArray(body.tags)
    ? body.tags.map((x: unknown) => String(x || "").trim()).filter(Boolean).slice(0, 12)
    : []
  const id =
    String(body.id || "").trim() ||
    `lst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "INVALID_LISTING_ID" }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ ok: false, error: "TITLE_REQUIRED" }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    return NextResponse.json({ ok: false, error: "INVALID_PRICE" }, { status: 400 })
  }
  if (decimalPlaces(price) > MAX_PRICE_DECIMALS) {
    return NextResponse.json(
      { ok: false, error: "PRICE_PRECISION", maxDecimals: MAX_PRICE_DECIMALS },
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

  // Preserve existing options for older clients that do not submit the field.
  // When supplied, reject malformed data instead of silently dropping seller choices.
  let productOptions = existing?.productOptions || []
  const suppliedProductOptions = body.productOptions
  if (suppliedProductOptions !== undefined) {
    if (!Array.isArray(suppliedProductOptions) || suppliedProductOptions.length > 4) {
      return NextResponse.json({ ok: false, error: "INVALID_PRODUCT_OPTIONS", message: "Use at most four product option groups." }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    productOptions = normalizeProductOptions(suppliedProductOptions)
    if (productOptions.length !== suppliedProductOptions.length || productOptions.some((option, index) => {
      const raw = suppliedProductOptions[index] as Record<string, unknown> | null
      return !raw || !Array.isArray(raw.values) || raw.values.length < 1 || raw.values.length > 12 || option.values.length !== raw.values.length
    })) {
      return NextResponse.json({ ok: false, error: "INVALID_PRODUCT_OPTIONS", message: "Each option needs a unique name and 1–12 valid values." }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
  }

  // Stock is an integer business quantity. An omitted value on edit preserves
  // current stock; an explicit zero stays zero. Never coerce zero to one.
  let variants = existing?.variants || []
  let variantsSupplied = Boolean(existing?.variants?.some((variant) => variant.active))
  const suppliedVariants = body.variants
  if (suppliedVariants !== undefined) {
    if (kind !== "product") return NextResponse.json({ ok: false, error: "VARIANTS_REQUIRE_PRODUCT_LISTING" }, { status: 400 })
    variantsSupplied = true
    if (!Array.isArray(suppliedVariants) || suppliedVariants.length > 100) {
      return NextResponse.json({ ok: false, error: "INVALID_PRODUCT_VARIANTS", message: "Use at most 100 SKU variants." }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const existingBySku = new Map((existing?.variants || []).map((variant) => [variant.sku.toLowerCase(), variant]))
    const candidate = suppliedVariants.map((raw: unknown) => {
      const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
      const sku = typeof row.sku === "string" ? row.sku.trim() : ""
      const prior = existingBySku.get(sku.toLowerCase())
      return {
        id: prior?.id || `var_${crypto.randomUUID()}`,
        sku,
        label: row.label,
        price: row.price,
        currency: row.currency || currency,
        stockOnHand: row.stockOnHand,
        active: row.active !== false,
      }
    })
    variants = normalizeProductVariants(candidate)
    if (variants.length !== candidate.length || variants.some((variant, index) => {
      const raw = candidate[index] as Record<string, unknown>
      return variant.currency !== currency || !Number.isSafeInteger(raw.stockOnHand) ||
        Number(raw.price) !== variant.price || Number(raw.stockOnHand) !== variant.stockOnHand
    })) {
      return NextResponse.json({ ok: false, error: "INVALID_PRODUCT_VARIANTS", message: "Each variant needs a unique SKU, label, valid price and whole-number stock in the listing currency." }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
  }

  const availability = parseMarketplaceAvailability(body.availability, existing?.availability ?? 1)
  if (availability === null) {
    return NextResponse.json({ ok: false, error: "INVALID_AVAILABILITY", message: "Stock must be a whole number from 0 to 9,999." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  // Server listing fee (display + gate). Never accept client fee.
  const preferredFee =
    String(body.feeCurrency || body.preferredFeeCurrency || "").toUpperCase() === "PI"
      ? "PI"
      : String(body.feeCurrency || body.preferredFeeCurrency || "").toUpperCase() === "GHC"
        ? "GHC"
        : undefined
  const listingFee = calculateMarketplaceListingFee({
    sellerPrice: price,
    currency,
    kind,
    preferredFeeCurrency: preferredFee,
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
    const referenceId = `marketplace_listing_fee_${id}`

    if (listingFee.feeCurrency === "GHC") {
      const settled = await settlePilotFee({
        userId: auth.userId,
        fee: {
          feature: "marketplace_listing",
          feeAmount: listingFee.feeAmount,
          feeCurrency: "GHC",
          ratesApproved: listingFee.ratesApproved,
          code: String(listingFee.code),
          basis: String(listingFee.basis),
        },
        referenceId,
        reason: `Marketplace listing fee · ${title}`,
        sourceEvent: "MARKETPLACE_LISTING_FEE",
        paymentRef: feePaymentRef || null,
        bindKey: "listingId",
        bindValue: id,
      })
      if (!settled.ok) {
        const err = settled.error || "LISTING_FEE_SETTLEMENT_FAILED"
        return NextResponse.json(
          {
            ok: false,
            error: err,
            message:
              err === "INSUFFICIENT_BALANCE"
                ? "Insufficient available GHC to activate this listing."
                : "Listing fee could not be settled from available GHC.",
            listingFee: {
              amount: listingFee.feeAmount,
              currency: listingFee.feeCurrency,
              ratesApproved: listingFee.ratesApproved,
              code: listingFee.code,
            },
            expectedReferenceId: referenceId,
          },
          {
            status:
              err === "INSUFFICIENT_BALANCE"
                ? 400
                : err === "SERVER_UNAVAILABLE"
                  ? 503
                  : 402,
          }
        )
      }
    } else {
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
              "Listing fee payment must be a completed intent owned by you, matching the server fee amount/currency, and bound to this listing.",
            listingFee: {
              amount: listingFee.feeAmount,
              currency: listingFee.feeCurrency,
              ratesApproved: listingFee.ratesApproved,
              code: listingFee.code,
            },
            expectedReferenceId: referenceId,
          },
          { status: verified.error === "LISTING_FEE_PAYMENT_REQUIRED" ? 402 : 403 }
        )
      }
    }
  }

  const listingInput = {
    id,
    sellerId: auth.userId,
    title,
    description: String(body.description || "").slice(0, 4000),
    price,
    currency,
    availability,
    status: status as "draft" | "active" | "paused" | "sold_out" | "removed",
    kind,
    media,
    location: location || undefined,
    shippingInfo: shippingInfo || undefined,
    category: category || undefined,
    condition: condition || undefined,
    tags,
    productOptions,
  }
  const saved = variantsSupplied
    ? await upsertListingWithVariants(listingInput, variants)
    : await upsertListing(listingInput)
  if (!saved.ok) {
    const durable =
      String(saved.error || "").includes("DATABASE") ||
      String(saved.error || "").includes("UPSERT") ||
      String(saved.error || "").includes("DURABLE") ||
      String(saved.error || "").includes("FORBIDDEN")
    const conflict = ["SKU_ALREADY_EXISTS", "VARIANT_HAS_ACTIVE_RESERVATIONS", "STOCK_BELOW_RESERVED", "VARIANT_ID_CONFLICT"].includes(String(saved.error || ""))
    const statusCode = conflict ? 409 :
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
    durable: true,
    listing: {
      id,
      sellerId: auth.userId,
      title,
      description: String(body.description || "").slice(0, 4000),
      price,
      currency,
      availability,
      status,
      kind,
      media,
      location,
      shippingInfo,
      category,
      condition,
      tags,
      productOptions,
      variants,
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
  const parsedFilters = parseFilterQuery(url.searchParams, { defaultLimit: 50, maxLimit: 100, sorts: ["price", "updated_at"] })
  if (!parsedFilters) return NextResponse.json({ ok: false, error: "INVALID_FILTER_QUERY" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  if (parsedFilters.latitude != null || parsedFilters.longitude != null || parsedFilters.radiusKm != null) return NextResponse.json({ ok: false, error: "LOCATION_FILTER_UNSUPPORTED", message: "Marketplace listings do not yet contain verified latitude/longitude coordinates; text location is not a distance radius." }, { status: 422, headers: { "Cache-Control": "no-store" } })
  const limit = parsedFilters.limit
  if ((parsedFilters.min != null && parsedFilters.min < 0) || (parsedFilters.max != null && parsedFilters.max < 0)) return NextResponse.json({ ok: false, error: "INVALID_PRICE_RANGE" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const offsetRaw = url.searchParams.get("offset") || "0"
  if (!/^\d{1,5}$/.test(offsetRaw) || Number(offsetRaw) > 10000) return NextResponse.json({ ok: false, error: "INVALID_OFFSET" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const rawKind = url.searchParams.get("kind") || ""
  const rawCurrency = url.searchParams.get("currency") || ""
  if (rawKind && !["product", "service", "opportunity"].includes(rawKind)) return NextResponse.json({ ok: false, error: "INVALID_KIND_FILTER" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  if (rawCurrency && !["GHC", "PI"].includes(rawCurrency)) return NextResponse.json({ ok: false, error: "INVALID_CURRENCY_FILTER" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  if ((parsedFilters.min != null || parsedFilters.max != null) && !rawCurrency) return NextResponse.json({ ok: false, error: "PRICE_CURRENCY_REQUIRED", message: "Select GHC or PI before applying a numeric price range." }, { status: 400, headers: { "Cache-Control": "no-store" } })

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
      { ok: true, durable: listingsDurable(), listing: serverListingToClient(listing) },
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
      {
        ok: true,
        durable: listingsDurable(),
        listings: listings.map(serverListingToClient),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  let listingsPlusOne: Awaited<ReturnType<typeof listActiveListings>>
  try {
    listingsPlusOne = await listActiveListings(limit, {
      q: parsedFilters.q,
      category: parsedFilters.category,
      min: parsedFilters.min,
      max: parsedFilters.max,
      from: parsedFilters.from,
      to: parsedFilters.to,
      offset: Number(offsetRaw),
      kind: rawKind ? rawKind as "product" | "service" | "opportunity" : undefined,
      currency: rawCurrency ? rawCurrency as "GHC" | "PI" : undefined,
      sort: parsedFilters.sort === "price" ? "price" : "updated_at",
      direction: parsedFilters.direction,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "LISTINGS_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  const hasMore = listingsPlusOne.length > limit
  const listings = listingsPlusOne.slice(0, limit)
  return NextResponse.json(
    {
      ok: true,
      durable: listingsDurable(),
      listings: listings.map(serverListingToClient),
      pagination: { limit, offset: Number(offsetRaw), returned: listings.length, hasMore, filtering: listingsDurable() ? "server-side" : "unavailable" },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
