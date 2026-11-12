/**
 * GET /api/payments/utility-status
 * Authenticated read-only: are π fee rails configured for marketplace/community?
 * Does not create payments or invent success.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { calculateMarketplaceListingFee, listingFeeRequiresSettlement } from "@/lib/server/marketplace/listing-fee"
import { quoteCommunityCreateFee, feesRequireSettlement } from "@/lib/server/fees/pilot-fee-policy"
import { isPiOnlyCommerceEnabled } from "@/lib/server/economy/pi-only-commerce"
import { listIntentsForUserAsync } from "@/lib/server/payments/intent-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }

  const piOnly = isPiOnlyCommerceEnabled()
  const listing = calculateMarketplaceListingFee({
    sellerPrice: 10,
    currency: "GHC",
    kind: "product",
    preferredFeeCurrency: "PI",
  })
  const community = quoteCommunityCreateFee("PI")
  const piKey = Boolean(String(process.env.PI_API_KEY || "").trim())

  let openIntents = 0
  try {
    const rows = await listIntentsForUserAsync(auth.userId)
    openIntents = (Array.isArray(rows) ? rows : []).filter((r) => {
      const st = String(r.status || "").toUpperCase()
      return !["FULFILLED", "CANCELLED", "REFUNDED", "FAILED"].includes(st)
    }).length
  } catch {
    openIntents = -1
  }

  const railsReady =
    piKey &&
    listing.feeCurrency === "PI" &&
    community.feeCurrency === "PI" &&
    piOnly

  return NextResponse.json(
    {
      ok: true,
      piOnlyCommerce: piOnly,
      piApiKeyConfigured: piKey,
      listingFeeSample: {
        amount: listing.feeAmount,
        currency: listing.feeCurrency,
        ratesApproved: listing.ratesApproved,
        requiresSettlement: listingFeeRequiresSettlement(listing),
      },
      communityCreateFeeSample: {
        amount: community.feeAmount,
        currency: community.feeCurrency,
        ratesApproved: community.ratesApproved,
        requiresSettlement: feesRequireSettlement(community),
      },
      openIntentsForUser: openIntents,
      railsReadyForSandboxProof: railsReady,
      sandboxSteps: [
        "1. In Pi Browser (sandbox/Testnet app), open Sell → publish listing",
        "2. Complete π listing-fee payment when prompted (do not skip)",
        "3. Confirm listing is active only after payment completes",
        "4. Create a community with π create fee if configured",
        "5. Wallet → Payment recovery: fulfil any COMPLETED-not-FULFILLED intents",
        "6. GET /api/payments/recovery/status should list only real owned intents",
      ],
      note: "This endpoint never creates payments or marks fulfilment. Source readiness ≠ live Pi transaction evidence.",
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
