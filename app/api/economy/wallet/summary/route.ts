import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
}
const unavailableHeaders = { ...noStore, "Retry-After": "5" }

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    }
    if (!socialDbConfigured()) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_UNAVAILABLE", retryable: true },
        { status: 503, headers: unavailableHeaders },
      )
    }

    const result = await socialRpc("ghc_wallet_v2_snapshot", { p_user_id: auth.userId })
    if (!result.ok || !result.data) {
      return NextResponse.json({
        ok: false,
        error: "WALLET_UNAVAILABLE",
        retryable: true,
        diagnosticCode: result.diagnosticCode || null,
      }, { status: 503, headers: unavailableHeaders })
    }

    return NextResponse.json({
      ok: true,
      wallet: result.data,
      source: "ghc_transactions",
      authority: "server_ledger",
      snapshotFetchedAt: new Date().toISOString(),
      sourceStatus: "authoritative_snapshot",
      noClientMinting: true,
    }, { headers: noStore })
  } catch {
    // A backend/auth dependency exception must not become a framework error page.
    // Never return cached or client-derived balances as a fallback.
    return NextResponse.json(
      { ok: false, error: "WALLET_SERVICE_UNAVAILABLE", retryable: true },
      { status: 503, headers: unavailableHeaders },
    )
  }
}
