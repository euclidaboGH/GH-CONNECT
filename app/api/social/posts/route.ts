/**
 * POST /api/social/posts — create post (author = session user only).
 * GET  /api/social/posts — alias of feed for convenience.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function genId(): string {
  return `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function GET(request: Request) {
  // Delegate shape-compatible to feed
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, posts: [] })
  }
  const result = await socialRpc("gh_post_list_feed", {
    p_viewer_id: auth.userId,
    p_limit: 40,
    p_before_ms: null,
  })
  const payload = result.data as { posts?: unknown[] }
  return NextResponse.json({
    ok: true,
    durable: result.ok,
    posts: Array.isArray(payload?.posts) ? payload.posts : [],
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const content = String(body.content || "").trim()
  const images = Array.isArray(body.images) ? body.images.map(String).slice(0, 10) : []
  const video = body.video ? String(body.video) : null
  const pdf = body.pdf ? String(body.pdf) : null
  const hasMedia = images.length > 0 || Boolean(video) || Boolean(pdf)
  if (!content && !hasMedia) {
    return NextResponse.json({ ok: false, error: "EMPTY_POST" }, { status: 400 })
  }
  if (content.length > 5000) {
    return NextResponse.json({ ok: false, error: "CONTENT_TOO_LONG" }, { status: 400 })
  }

  const visibility = ["public", "followers", "mutuals", "private"].includes(
    String(body.visibility || "")
  )
    ? String(body.visibility)
    : "public"

  // Author is ALWAYS session identity — never trust body.authorId
  const id = String(body.id || "").trim() || genId()
  const row = {
    id,
    authorId: auth.userId,
    authorName: String(body.authorName || auth.username || "Member").slice(0, 120),
    authorPhoto: String(body.authorPhoto || "").slice(0, 2000),
    content,
    images,
    video,
    pdf,
    pdfName: body.pdfName ? String(body.pdfName).slice(0, 200) : null,
    visibility,
    listingId: body.listingId ? String(body.listingId) : null,
    listingKind: body.listingKind ? String(body.listingKind) : null,
    communityId: body.communityId ? String(body.communityId) : null,
    communityName: body.communityName ? String(body.communityName) : null,
    contentType: body.contentType ? String(body.contentType) : "standard",
    createdAt: Date.now(),
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      post: row,
      message: "SOCIAL_DB_UNAVAILABLE — local session remains until migration",
    })
  }

  const result = await socialRpc("gh_post_create", { p_row: row })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "CREATE_FAILED", durable: false },
      { status: 503 }
    )
  }
  const data = result.data as { ok?: boolean; error?: string }
  if (data && data.ok === false) {
    return NextResponse.json(
      { ok: false, error: data.error || "CREATE_REJECTED" },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, durable: true, post: row })
}
