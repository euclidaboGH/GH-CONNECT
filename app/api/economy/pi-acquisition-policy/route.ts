/** GET /api/economy/pi-acquisition-policy — read-only Phase 6 proposal. */
import { NextResponse } from "next/server"
import { getPiGhcAcquisitionProposal } from "@/lib/server/monetization/pi-acquisition-proposal"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    { ok: true, proposal: getPiGhcAcquisitionProposal() },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}
