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
  const availability = Math.max(0, Math.min(9999, Math.floor(Number(body.availability) || 1)))
  let status = String(body.status || "draft")
  const kind = String(body.kind || "product").slice(0, 64)
  const location = String(body.location || "").trim().slice(0, 120)
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
    media,
    location: location || undefined,
    category: category || undefined,
    condition: condition || undefined,
    tags,
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
      category,
      condition,
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

  const listings = await listActiveListings(limit)
  return NextResponse.json(
    {
      ok: true,
      durable: listingsDurable(),
      listings: listings.map(serverListingToClient),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
