/**
 * GET /api/health/withdrawals
 *
 * Read-only Testnet Preview diagnostics for Pi earnings withdrawal infrastructure.
 * - Does not initiate A2U payouts or mutate ledger state
 * - Does not evaluate a specific user's eligibility
 * - Does not expose secrets, tokens, or user identifiers
 *
 * Prefer /api/economy/earnings/withdrawable (authenticated) for per-user eligibility.
 */

import { NextResponse } from "next/server"
import {
  evaluateWithdrawalsHealth,
  withdrawalsHealthHttpStatus,
} from "@/lib/server/health/withdrawals-health"
import { diagnosticsDetailAllowed } from "@/lib/server/security/operator-key"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  let hostname: string | null = null
  try {
    hostname = new URL(request.url).hostname
  } catch {
    /* ignore malformed URL */
  }

  const report = await evaluateWithdrawalsHealth({ hostname })
  const status = withdrawalsHealthHttpStatus(report)

  if (!diagnosticsDetailAllowed(request)) {
    // Anonymous callers only learn the coarse state. Per-variable gate hints (including the
    // format state of payout secrets) are operator-only.
    return NextResponse.json(
      { ok: report.status !== "blocked", status: report.status, detail: "restricted" },
      { status, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache" } },
    )
  }

  return NextResponse.json(report, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      "X-GH-Withdrawals-Health": report.status,
      "X-GH-Health-Scope": "infrastructure",
    },
  })
}
