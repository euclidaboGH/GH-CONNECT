import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableReadResponse } from "@/lib/server/production-guard"
import { hydratePublicProfileIdentity } from "@/lib/server/identity/public-profile-hydration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseLimit(value: string | null): number | null {
  if (value == null) return 40
  if (!/^\d{1,3}$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : null
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })

  const { id } = await ctx.params
  const communityId = String(id || "").trim()
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(communityId)) {
    return NextResponse.json({ ok: false, error: "INVALID_COMMUNITY_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Community posts", { posts: [] })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }

  const url = new URL(request.url)
  const beforeMsRaw = url.searchParams.get("before")
  const beforeIdRaw = url.searchParams.get("beforeId")
  const beforeMs = beforeMsRaw == null ? null : Number(beforeMsRaw)
  if ((beforeMsRaw == null) !== (beforeIdRaw == null) || (beforeMs != null && (!Number.isSafeInteger(beforeMs) || beforeMs < 0)) || (beforeIdRaw != null && !/^[a-zA-Z0-9_-]{1,180}$/.test(beforeIdRaw))) {
    return NextResponse.json({ ok: false, error: "INVALID_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const limit = parseLimit(url.searchParams.get("limit"))
  if (limit == null) return NextResponse.json({ ok: false, error: "INVALID_LIMIT" }, { status: 400, headers: { "Cache-Control": "no-store" } })

  const result = await socialRpc("gh_community_post_list", {
    p_community_id: communityId,
    p_viewer_id: auth.userId,
    p_limit: limit,
    p_before_ms: beforeMs,
    p_before_id: beforeIdRaw,
  })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "COMMUNITY_POSTS_UNAVAILABLE", durable: false }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }

  const payload = result.data as { ok?: boolean; error?: string; posts?: unknown[] } | null
  if (payload?.ok === false) {
    const forbidden = payload.error === "FORBIDDEN"
    return NextResponse.json({ ok: false, error: forbidden ? "FORBIDDEN" : String(payload.error || "COMMUNITY_POSTS_UNAVAILABLE") }, { status: forbidden ? 403 : 503, headers: { "Cache-Control": "no-store" } })
  }
  const rows = Array.isArray(payload?.posts) ? payload.posts : []
  const posts = await hydratePublicProfileIdentity(rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")))
  return NextResponse.json({ ok: true, durable: true, posts }, { headers: { "Cache-Control": "no-store" } })
}
