/**
 * GET /api/pi/staking
 *
 * App-specific Ecosystem Directory Staking data (Pi Sep 2026 capability).
 * Official blog: effective stake = amount × duration boost for THIS app only.
 * Access initially requires app whitelist from Pi.
 *
 * Until whitelist + official Platform API shape are confirmed in docs.minepi.com,
 * this endpoint returns a safe stub:
 *   { available: false, reason: "not_whitelisted_or_unconfigured" }
 *
 * SECURITY:
 * - Never trusts client-supplied stake amounts for authorization.
 * - When live, server will call Pi Platform with PI_API_KEY and cache result.
 * - Stake is a product SIGNAL only — not payment authority, not GHC balance.
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  // Optional auth — if present, scope response to that user
  let ghUserId: string | null = null
  try {
    const user = await resolveAuthenticatedUser(request)
    ghUserId = user?.userId || null
  } catch {
    /* guest probe allowed for availability */
  }

  const whitelistEnabled =
    process.env.PI_STAKING_API_ENABLED === "true" ||
    process.env.PI_STAKING_API_ENABLED === "1"

  // Future: call Pi Platform staking endpoint with PI_API_KEY when documented.
  // Placeholder keeps contract stable for clients.
  if (!whitelistEnabled) {
    return NextResponse.json(
      {
        ok: true,
        available: false,
        reason: "not_whitelisted_or_unconfigured",
        docs: "https://docs.minepi.com",
        blog: "https://minepi.com/blog/dev-capabilities-documentation/",
        message:
          "Staking Data API requires Pi app whitelist. Set PI_STAKING_API_ENABLED=true only after Platform access is granted.",
        ghUserId,
        effectiveStake: null,
        tiers: [
          { id: "supporter", minEffective: 1, label: "Supporter" },
          { id: "advocate", minEffective: 100, label: "Advocate" },
          { id: "champion", minEffective: 1000, label: "Champion" },
        ],
        ts: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  // Enabled flag set but live Pi API not wired yet — still fail closed for amounts
  return NextResponse.json(
    {
      ok: true,
      available: false,
      reason: "api_not_wired",
      message:
        "PI_STAKING_API_ENABLED is set but the Platform staking fetch is not implemented until official endpoint docs are confirmed.",
      ghUserId,
      effectiveStake: null,
      ts: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
