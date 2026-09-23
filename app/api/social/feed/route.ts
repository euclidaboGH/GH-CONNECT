/**
 * GET /api/social/feed — durable feed for authenticated viewer.
 * Server derives actor from session; client cannot impersonate.
 * Post-filters muted authors when mute rows are available.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc, socialRest } from "@/lib/server/social/rpc"

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
    return NextResponse.json(
      { ok: true, durable: false, posts: [], message: "SOCIAL_DB_UNAVAILABLE" },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 100)
  const before = url.searchParams.get("before")
  const beforeMs = before ? Number(before) : null

  const result = await socialRpc("gh_post_list_feed", {
    p_viewer_id: auth.userId,
    p_limit: limit,
    p_before_ms: beforeMs && Number.isFinite(beforeMs) ? beforeMs : null,
  })

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

  return NextResponse.json(
    { ok: true, durable: true, posts, mutedFiltered: muted.size },
    { headers: { "Cache-Control": "no-store" } }
  )
}
