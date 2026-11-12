/**
 * GET /api/communities/create-fee?currency=GHC|PI
 * Server-authoritative community create fee quote.
 */
import { NextResponse } from "next/server"
import { quoteCommunityCreateFee, feesRequireSettlement } from "@/lib/server/fees/pilot-fee-policy"
import { isPiOnlyCommerceEnabled } from "@/lib/server/economy/pi-only-commerce"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  let preferred: "PI" | "GHC" =
    String(url.searchParams.get("currency") || "GHC").toUpperCase() === "PI" ? "PI" : "GHC"
  if (isPiOnlyCommerceEnabled()) preferred = "PI"
  const fee = quoteCommunityCreateFee(preferred)
  return NextResponse.json(
    {
      ok: true,
      fee: {
        amount: fee.feeAmount,
        currency: fee.feeCurrency,
        ratesApproved: fee.ratesApproved,
        code: fee.code,
        requiresSettlement: feesRequireSettlement(fee),
        nonRefundable: true,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
