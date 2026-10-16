/**
 * GET /api/social/profile/:userId/posts
 * Viewer-authorized, paginated profile timeline and media search.
 * Authorization is enforced again inside the service-role RPC; client-supplied
 * viewer IDs are never accepted.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })

  const { userId: rawUserId } = await ctx.params
  const profileId = String(rawUserId || "").trim()
  if (!profileId || profileId.length > 160 || /[\u0000-\u001f]/.test(profileId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PROFILE_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const rl = checkRateLimit(`profile-content:${auth.userId}`, 90, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } })

  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Profile content library", { posts: [], hasMore: false, nextBefore: null })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }

  const url = new URL(request.url)
  const limitRaw = Number(url.searchParams.get("limit") || 30)
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30
  const beforeRaw = url.searchParams.get("before")
  const beforeIdRaw = url.searchParams.get("beforeId") || ""
  let before: number | null = null
  let beforeId: string | null = null
  if (beforeRaw !== null || beforeIdRaw !== "") {
    const parsedBefore = beforeRaw !== null && /^\d{1,16}$/.test(beforeRaw) ? Number(beforeRaw) : NaN
    if (!Number.isSafeInteger(parsedBefore) || parsedBefore <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_CONTENT_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (!beforeIdRaw || beforeIdRaw.length > 160 || /[\u0000-\u001f\u007f]/.test(beforeIdRaw)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONTENT_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    before = parsedBefore
    beforeId = beforeIdRaw
  }
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120)
  const mediaKind = (url.searchParams.get("kind") || "all").toLowerCase()
  const allowedKinds = new Set(["all", "posts", "photos", "videos", "documents"])

  const result = await socialRpc("gh_post_list_profile_content", {
    p_viewer_id: auth.userId,
    p_profile_id: profileId,
    p_limit: limit,
    p_before_ms: before,
    p_before_id: beforeId,
    p_query: query,
    p_media_kind: allowedKinds.has(mediaKind) ? mediaKind : "all",
  })
  if (!result.ok) {
    const migrationMissing = result.status === 404
    return NextResponse.json({
      ok: false,
      error: migrationMissing ? "PROFILE_CONTENT_MIGRATION_REQUIRED" : result.error || "PROFILE_CONTENT_UNAVAILABLE",
      message: migrationMissing
        ? "Apply supabase/migrations/20261023_gh_profile_content_library.sql on Testnet before using profile content search."
        : "Profile content is temporarily unavailable. Please try again shortly.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  const data = result.data as { ok?: boolean; error?: string; posts?: unknown[]; hasMore?: boolean; nextBefore?: number | null; nextBeforeId?: string | null }
  if (data?.ok === false) return NextResponse.json({ ok: false, error: data.error || "PROFILE_CONTENT_UNAVAILABLE" }, { status: 400 })
  return NextResponse.json({
    ok: true,
    durable: true,
    posts: Array.isArray(data?.posts) ? data.posts : [],
    hasMore: Boolean(data?.hasMore),
    nextBefore: typeof data?.nextBefore === "number" ? data.nextBefore : null,
    nextBeforeId: typeof data?.nextBeforeId === "string" ? data.nextBeforeId : null,
  }, { headers: { "Cache-Control": "no-store" } })
}
