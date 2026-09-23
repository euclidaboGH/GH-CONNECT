/** GET /api/social/mutes/list — hydrate durable mute list for session user */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRest } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json(
      { ok: true, durable: false, mutedIds: [] },
      { headers: { "Cache-Control": "no-store" } }
    )
  }
  try {
    const q = `gh_user_mutes?muter_id=eq.${encodeURIComponent(auth.userId)}&select=muted_id`
    const result = await socialRest<Array<{ muted_id: string }>>(q)
    const mutedIds =
      result.ok && Array.isArray(result.data)
        ? result.data.map((r) => String(r.muted_id)).filter(Boolean)
        : []
    return NextResponse.json(
      { ok: true, durable: true, mutedIds },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: "MUTE_LIST_FAILED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
