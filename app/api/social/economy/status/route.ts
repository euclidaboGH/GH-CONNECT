import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { curationRedistributeEnabled } from "@/lib/server/curation/redistribute"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "SOCIAL_STORE_UNAVAILABLE" }, { status: 503 })

  const snapshot = await socialRpc("gh_social_economy_snapshot", { p_user_id: auth.userId })
  if (!snapshot.ok || !snapshot.data) {
    return NextResponse.json({
      ok: false,
      error: "SOCIAL_ECONOMY_UNAVAILABLE",
      diagnosticCode: snapshot.diagnosticCode || null,
      diagnosticMessage: snapshot.diagnosticMessage || null,
    }, { status: 503 })
  }

  return NextResponse.json({
    ...(snapshot.data as Record<string, unknown>),
    ok: true,
    server: {
      curationRedistributeEnabled: curationRedistributeEnabled(),
      balanceFunding: true,
      issuanceFromSocialActions: false,
    },
  }, { headers: { "Cache-Control": "no-store, max-age=0" } })
}
