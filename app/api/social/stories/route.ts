/**
 * GET  /api/social/stories — active non-expired stories for viewer
 * POST /api/social/stories — create (owner = session)
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function genId(): string {
  return `story_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, stories: [] })
  }
  const result = await socialRpc("gh_story_list_active", {
    p_viewer_id: auth.userId,
  })
  const data = result.data as { stories?: unknown[] }
  return NextResponse.json({
    ok: true,
    durable: result.ok,
    stories: Array.isArray(data?.stories) ? data.stories : [],
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const text = String(body.text || "").trim()
  const mediaUrl = body.media?.url || body.mediaUrl || null
  if (!text && !mediaUrl) {
    return NextResponse.json({ ok: false, error: "EMPTY_STORY" }, { status: 400 })
  }

  const expiresAt =
    typeof body.expiresAt === "number" && body.expiresAt > Date.now()
      ? body.expiresAt
      : Date.now() + 24 * 60 * 60 * 1000

  const row = {
    id: String(body.id || "").trim() || genId(),
    ownerId: auth.userId,
    ownerName: String(body.name || body.ownerName || auth.username || "Member").slice(
      0,
      120
    ),
    ownerPhoto: String(body.photo || body.ownerPhoto || "").slice(0, 2000),
    text,
    mediaType: body.media?.type || body.mediaType || (mediaUrl ? "image" : null),
    mediaUrl: mediaUrl ? String(mediaUrl).slice(0, 4000) : null,
    audience: ["everyone", "followers", "friends", "matches-only", "private"].includes(
      String(body.audience || "")
    )
      ? String(body.audience)
      : "everyone",
    expiresAt,
    createdAt: Date.now(),
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, story: row })
  }

  const result = await socialRpc("gh_story_create", { p_row: row })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "STORY_CREATE_FAILED" },
      { status: 503 }
    )
  }
  return NextResponse.json({ ok: true, durable: true, story: row })
}
