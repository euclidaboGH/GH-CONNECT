/**
 * GET /api/marketplace/listing-fee?mode=create|edit&price=10&currency=GHC
 * Server-authoritative fee quote for sell/edit CTAs.
 */
import { NextResponse } from "next/server"
import {
  calculateMarketplaceListingFee,
  listingFeeRequiresSettlement,
} from "@/lib/server/marketplace/listing-fee"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = (url.searchParams.get("mode") || "create").toLowerCase()
  const price = Number(url.searchParams.get("price") || 0)
  const currency = String(url.searchParams.get("currency") || "GHC").toUpperCase()
  const kind = String(url.searchParams.get("kind") || "product")
  const preferred = String(url.searchParams.get("feeCurrency") || url.searchParams.get("preferredFeeCurrency") || "").toUpperCase()
  const preferredFeeCurrency = preferred === "PI" || preferred === "GHC" ? preferred : undefined

  const fee = calculateMarketplaceListingFee({
    sellerPrice: Number.isFinite(price) && price >= 0 ? price : 0,
    currency,
    kind,
    preferredFeeCurrency,
  })

  let amount = fee.feeAmount
  if (mode === "edit") {
    amount = Math.round((amount / 2) * 1e8) / 1e8
  }

  return NextResponse.json(
    {
      ok: true,
      mode: mode === "edit" ? "edit" : "create",
      fee: {
        amount,
        currency: fee.feeCurrency,
        ratesApproved: fee.ratesApproved,
        code: fee.code,
        basis: fee.basis,
        requiresSettlement: listingFeeRequiresSettlement({ ...fee, feeAmount: amount }),
        nonRefundable: true,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
