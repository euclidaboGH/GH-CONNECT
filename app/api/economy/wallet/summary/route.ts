import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache" }

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503, headers: noStore })

  const result = await socialRpc("ghc_wallet_v2_snapshot", { p_user_id: auth.userId })
  if (!result.ok || !result.data) {
    return NextResponse.json({
      ok: false,
      error: "WALLET_UNAVAILABLE",
      diagnosticCode: result.diagnosticCode || null,
    }, { status: 503, headers: noStore })
  }

  return NextResponse.json({
    ok: true,
    wallet: result.data,
    source: "ghc_transactions",
    authority: "server_ledger",
    noClientMinting: true,
  }, { headers: noStore })
}
