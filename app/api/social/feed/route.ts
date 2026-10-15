/**
 * GET /api/social/feed — durable feed for authenticated viewer.
 * Server derives actor from session; client cannot impersonate.
 * Post-filters muted authors when mute rows are available.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc, socialRest } from "@/lib/server/social/rpc"
import { nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function mutedAuthorIds(viewerId: string): Promise<Set<string>> {
  const out = new Set<string>()
  try {
    const q = `gh_user_mutes?muter_id=eq.${encodeURIComponent(viewerId)}&select=muted_id`
    const result = await socialRest<Array<{ muted_id: string }>>(q)
    if (result.ok && Array.isArray(result.data)) {
      for (const row of result.data) {
        const id = String(row.muted_id || "").trim()
        if (id) out.add(id)
      }
    }
  } catch {
    /* feed still returns; mute filter best-effort */
  }
  return out
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Social feed", { posts: [], message: "SOCIAL_DB_UNAVAILABLE" })
    return NextResponse.json(nd.body, {
      status: nd.status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 50)
  const before = url.searchParams.get("before")
  const beforeIdRaw = (url.searchParams.get("beforeId") || "").trim()
  const beforeMs = before ? Number(before) : null
  const hasCursor = before !== null || beforeIdRaw !== ""
  if (hasCursor && (!beforeMs || !Number.isSafeInteger(beforeMs) || beforeMs <= 0 || !beforeIdRaw || beforeIdRaw.length > 160)) {
    return NextResponse.json({ ok: false, error: "INVALID_FEED_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  // V2 uses a stable (createdAt,id) cursor so equal-timestamp posts cannot be skipped.
  // Fall back to the legacy RPC until the additive V2 migration is applied.
  let result = await socialRpc("gh_post_list_feed_v2", {
    p_viewer_id: auth.userId,
    p_limit: limit,
    p_before_ms: hasCursor ? beforeMs : null,
    p_before_id: hasCursor ? beforeIdRaw : null,
  })
  let stableCursor = result.ok
  if (!result.ok) {
    result = await socialRpc("gh_post_list_feed", {
      p_viewer_id: auth.userId,
      p_limit: limit,
      p_before_ms: hasCursor ? beforeMs : null,
    })
    stableCursor = false
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: true,
        durable: false,
        posts: [],
        message: result.error || "FEED_RPC_UNAVAILABLE",
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const payload = result.data as { ok?: boolean; posts?: unknown[] }
  let posts = Array.isArray(payload?.posts) ? payload.posts : []

  // Server-side mute enforcement (RPC still handles blocks)
  const muted = await mutedAuthorIds(auth.userId)
  if (muted.size > 0) {
    posts = posts.filter((p) => {
      const authorId = String(
        (p as { authorId?: string; author_id?: string }).authorId ||
          (p as { author_id?: string }).author_id ||
          ""
      )
      return !authorId || !muted.has(authorId)
    })
  }

  const last = posts.length ? (posts[posts.length - 1] as { id?: string; createdAt?: number }) : null
  const nextCursor = last?.id && Number.isFinite(Number(last?.createdAt))
    ? { before: Number(last.createdAt), beforeId: String(last.id) }
    : null

  return NextResponse.json(
    { ok: true, durable: true, posts, mutedFiltered: muted.size, nextCursor, stableCursor },
    { headers: { "Cache-Control": "no-store" } }
  )
}
