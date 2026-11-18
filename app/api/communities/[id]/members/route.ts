/** Canonical community member directory; only public profile identity fields. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { sanitizeCommunityId } from "@/lib/server/community/community-integrity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private" }
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  if (auth.source !== "gh_session" || !auth.sessionId) return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 403, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`community-directory:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, { status: durableRateLimitStatus(rate), headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } })
  const { id } = await ctx.params
  const communityId = sanitizeCommunityId(id)
  if (!communityId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: NO_STORE })
  const url = new URL(request.url)
  const rawLimit = Number(url.searchParams.get("limit") || "50")
  const rawOffset = Number(url.searchParams.get("offset") || "0")
  const limit = Number.isSafeInteger(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50
  const offset = Number.isSafeInteger(rawOffset) ? Math.min(5000, Math.max(0, rawOffset)) : 0
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "STORE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const result = await socialRpc("gh_community_member_directory", { p_community_id: communityId, p_viewer_id: auth.userId, p_limit: limit, p_offset: offset })
  const data = result.data as { ok?: boolean; error?: string; members?: unknown[]; total?: number; hasMore?: boolean } | null
  if (!result.ok || !data?.ok || !Array.isArray(data.members)) {
    const code = data?.error || result.error || "DIRECTORY_UNAVAILABLE"
    return NextResponse.json({ ok: false, error: code }, { status: code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 503, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true, durable: true, members: data.members, total: Number(data.total) || 0, hasMore: Boolean(data.hasMore), limit, offset }, { headers: NO_STORE })
}
