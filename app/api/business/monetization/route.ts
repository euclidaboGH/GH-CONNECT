/** GET /api/business/monetization — public, read-only business offer preview. */
import { NextResponse } from "next/server"
import { getBusinessMonetizationPolicy } from "@/lib/server/monetization/business-catalog"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    { ok: true, policy: getBusinessMonetizationPolicy() },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}
