/**
 * GET /api/economy/policy — public, read-only GHC utility rules and catalog.
 * Contains no account, balance, or private operational data.
 */
import { NextResponse } from "next/server"
import { getPublicGhcEconomyPolicy } from "@/lib/server/economy/public-policy"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    { ok: true, policy: getPublicGhcEconomyPolicy() },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}
