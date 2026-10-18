/**
 * GET  /api/social/stories — active non-expired stories for viewer
 * POST /api/social/stories — create (owner = session)
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc, socialRest } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function genId(): string {
  return `story_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

type StoryRequestBody = {
  text?: unknown
  media?: { url?: unknown; type?: unknown }
  mediaUrl?: unknown
  mediaType?: unknown
  expiresAt?: unknown
  photo?: unknown
  ownerPhoto?: unknown
  audience?: unknown
  background?: unknown
}

const SAFE_STORY_BACKGROUNDS = new Set([
  "linear-gradient(145deg,#064e3b 0%,#047857 48%,#0f172a 100%)",
  "linear-gradient(145deg,#7c2d12 0%,#db2777 52%,#4c1d95 100%)",
  "linear-gradient(145deg,#082f49 0%,#0369a1 52%,#312e81 100%)",
  "linear-gradient(145deg,#713f12 0%,#ca8a04 52%,#9a3412 100%)",
  "linear-gradient(145deg,#4a044e 0%,#a21caf 55%,#831843 100%)",
  "linear-gradient(145deg,#111827 0%,#334155 52%,#020617 100%)",
])

function safeStoryMediaUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw || raw.length > 4000 || /[\u0000-\u001f\u007f]/.test(raw)) return null
  // Small inline images are retained for compatibility with the existing compressed-image fallback.
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(raw)) {
    return raw.length <= 512 * 1024 ? raw : null
  }
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null
    return parsed.href
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  const rl = checkRateLimit(`stories-list:${auth.userId}`, 120, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })
  }
  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Stories", { stories: [] })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }
  const result = await socialRpc("gh_story_list_active", {
    p_viewer_id: auth.userId,
  })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "STORY_LIST_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  const data = result.data as { stories?: unknown[] }
  const stories = Array.isArray(data?.stories) ? data.stories : []
  const storyRows = stories.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
  const ids = Array.from(new Set(storyRows.map((story) => String(story.id || "").trim()).filter(Boolean))).slice(0, 100)
  let enrichedStories: unknown[] = stories
  if (ids.length) {
    try {
      const quotedIds = `in.(${ids.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")})`
      const query = new URLSearchParams({ story_id: quotedIds, select: "story_id,user_id,reaction", limit: "5000" })
      const reactions = await socialRest<Array<{ story_id?: string; user_id?: string; reaction?: string }>>(`gh_story_reactions?${query.toString()}`)
      const countsByStory = new Map<string, Record<string, number>>()
      const mineByStory = new Map<string, string[]>()
      if (reactions.ok && Array.isArray(reactions.data)) {
        for (const row of reactions.data) {
          const storyId = String(row.story_id || "")
          const reaction = String(row.reaction || "")
          if (!storyId || !reaction || !ids.includes(storyId)) continue
          const counts = countsByStory.get(storyId) || {}
          counts[reaction] = (counts[reaction] || 0) + 1
          countsByStory.set(storyId, counts)
          if (String(row.user_id || "") === auth.userId) {
            const mine = mineByStory.get(storyId) || []
            if (!mine.includes(reaction)) mine.push(reaction)
            mineByStory.set(storyId, mine)
          }
        }
      }
      enrichedStories = storyRows.map((story) => {
        const id = String(story.id || "")
        const reactionCounts = countsByStory.get(id) || {}
        return {
          ...story,
          reactionCounts,
          viewerReactions: mineByStory.get(id) || [],
          reactionCount: Object.values(reactionCounts).reduce((sum, count) => sum + count, 0),
        }
      })
    } catch {
      /* Story cards still render their media/text if reaction counts cannot load. */
    }
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    stories: enrichedStories,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  const rl = checkRateLimit(`stories-create:${auth.userId}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })
  }
  const contentLength = request.headers.get("content-length")
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 1024 * 1024)) {
    return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } })
  }
  const body = await request.json().catch(() => null) as StoryRequestBody | null
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (text.length > 2000) {
    return NextResponse.json({ ok: false, error: "STORY_TOO_LONG" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const mediaCandidate = body.media?.url ?? body.mediaUrl ?? null
  const mediaUrl = mediaCandidate == null || mediaCandidate === "" ? null : safeStoryMediaUrl(mediaCandidate)
  if (mediaCandidate && !mediaUrl) {
    return NextResponse.json({ ok: false, error: "INVALID_MEDIA_URL", message: "Use a secure HTTPS media URL or a small compressed image." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  if (!text && !mediaUrl) {
    return NextResponse.json({ ok: false, error: "EMPTY_STORY" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  // Authoritative expiry: max 24h from server clock — client cannot extend indefinitely
  const MAX_STORY_MS = 24 * 60 * 60 * 1000
  const now = Date.now()
  const requested =
    typeof body.expiresAt === "number" && body.expiresAt > now ? body.expiresAt : now + MAX_STORY_MS
  const expiresAt = Math.min(requested, now + MAX_STORY_MS)

  const requestedMediaType = String(body.media?.type || body.mediaType || "").toLowerCase()
  if (requestedMediaType && !["image", "video"].includes(requestedMediaType)) {
    return NextResponse.json({ ok: false, error: "INVALID_MEDIA_TYPE" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const row = {
    // IDs and identity labels are server-derived so clients cannot spoof an existing story.
    id: genId(),
    ownerId: auth.userId,
    ownerName: String(auth.username || "Member").trim().slice(0, 120) || "Member",
    ownerPhoto: safeStoryMediaUrl(body.photo || body.ownerPhoto) || "",
    text,
    mediaType: requestedMediaType || (mediaUrl ? "image" : null),
    mediaUrl,
    background: typeof body.background === "string" && SAFE_STORY_BACKGROUNDS.has(body.background) ? body.background : null,
    audience: ["everyone", "followers", "friends", "matches-only", "private"].includes(
      String(body.audience || "")
    )
      ? String(body.audience)
      : "everyone",
    expiresAt,
    createdAt: Date.now(),
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Story create", { extra: { story: null } })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }

  const result = await socialRpc("gh_story_create", { p_row: row })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "STORY_CREATE_FAILED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
  const resultData = result.data as { ok?: boolean; error?: string } | null
  if (resultData?.ok === false) {
    return NextResponse.json({ ok: false, error: "STORY_CREATE_FAILED" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, durable: true, story: row }, { headers: { "Cache-Control": "no-store" } })
}
