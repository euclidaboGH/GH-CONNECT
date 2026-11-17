/**
 * GET  /api/social/stories — active non-expired stories for viewer
 * POST /api/social/stories — create (owner = session)
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc, socialRest } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { hydratePublicProfileIdentity } from "@/lib/server/identity/public-profile-hydration"
import { getServerProfile } from "@/lib/server/identity/profile-store"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

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
  if (!raw || raw.length > 512 * 1024 || /[\u0000-\u001f\u007f]/.test(raw)) return null
  // Inline fallback is deliberately image-only and small enough for the bounded JSON route.
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(raw)) {
    return raw.length <= 512 * 1024 ? raw : null
  }
  // Persist only the first-party media facade. Arbitrary HTTPS and short-lived signed URLs
  // are not durable story attachments and can bypass viewer-aware media authorization.
  if (/^\/api\/media\/media_[a-z0-9]+_[a-z0-9]+\/content\/?$/i.test(raw)) {
    return raw.replace(/\/$/, "")
  }
  return null
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
  // Compatibility bridge for databases that have not yet received the Phase 2
  // aggregate projection migration. Once the RPC returns reactionCounts, this
  // bounded fallback is skipped and the list remains a single database read.
  let projectedStories = storyRows
  if (storyRows.some((story) => !story.reactionCounts || typeof story.reactionCounts !== "object")) {
    const ids = Array.from(new Set(storyRows.map((story) => String(story.id || "").trim()).filter(Boolean))).slice(0, 100)
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
        projectedStories = storyRows.map((story) => {
          if (story.reactionCounts && typeof story.reactionCounts === "object") return story
          const counts = countsByStory.get(String(story.id || "")) || {}
          return { ...story, reactionCounts: counts, viewerReactions: mineByStory.get(String(story.id || "")) || [], reactionCount: Object.values(counts).reduce((sum, count) => sum + count, 0) }
        })
      } catch {
        // The stories remain readable; engagement counts can hydrate on the next refresh.
      }
    }
  }
  const publicStories = await hydratePublicProfileIdentity(projectedStories)
  return NextResponse.json({
    ok: true,
    durable: true,
    stories: publicStories,
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
  // Enforce a hard streaming limit even when Content-Length is absent or false.
  // Story media is URL-based or a deliberately small compressed inline image.
  const parsedBody = await readBoundedJson(request, 1024 * 1024)
  if (!parsedBody.ok) {
    const tooLarge = parsedBody.error === "REQUEST_TOO_LARGE"
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: tooLarge ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  }
  const body = parsedBody.value as StoryRequestBody & { id?: unknown }
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (text.length > 500) {
    return NextResponse.json({ ok: false, error: "STORY_TOO_LONG" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const requestedId = typeof body.id === "string" ? body.id.trim() : ""
  if (requestedId && !/^story_[a-z0-9_-]{8,100}$/i.test(requestedId)) {
    return NextResponse.json({ ok: false, error: "INVALID_STORY_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const storyId = requestedId || genId()
  const mediaCandidate = body.media?.url ?? body.mediaUrl ?? null
  const mediaUrl = mediaCandidate == null || mediaCandidate === "" ? null : safeStoryMediaUrl(mediaCandidate)
  if (mediaCandidate && !mediaUrl) {
    return NextResponse.json({ ok: false, error: "INVALID_MEDIA_URL", message: "Attach a photo or video through GreenHaven's secure media uploader." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  if (!text && !mediaUrl) {
    return NextResponse.json({ ok: false, error: "EMPTY_STORY" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const requestedMediaType = String(body.media?.type || body.mediaType || "").toLowerCase()
  if (requestedMediaType && !["image", "video"].includes(requestedMediaType)) {
    return NextResponse.json({ ok: false, error: "INVALID_MEDIA_TYPE" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  let mediaType: "image" | "video" | null = mediaUrl ? (requestedMediaType === "video" ? "video" : "image") : null
  if (mediaUrl?.startsWith("/api/media/")) {
    const mediaId = mediaUrl.match(/^\/api\/media\/(media_[a-z0-9]+_[a-z0-9]+)\/content$/i)?.[1]
    if (!mediaId) return NextResponse.json({ ok: false, error: "INVALID_MEDIA_URL" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    const authorization = await socialRpc("gh_media_authorize_viewer", {
      p_media_id: mediaId,
      p_viewer_id: auth.userId,
    })
    if (!authorization.ok) return NextResponse.json({ ok: false, error: "MEDIA_AUTHORIZATION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
    const asset = authorization.data as { ok?: boolean; ownerId?: string; kind?: string } | null
    if (!asset?.ok || asset.ownerId !== auth.userId || !["image", "video"].includes(String(asset.kind))) {
      return NextResponse.json({ ok: false, error: "MEDIA_NOT_OWNED_OR_READY" }, { status: 403, headers: { "Cache-Control": "no-store" } })
    }
    if (requestedMediaType && requestedMediaType !== asset.kind) {
      return NextResponse.json({ ok: false, error: "MEDIA_TYPE_MISMATCH" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    mediaType = asset.kind as "image" | "video"
  } else if (mediaUrl && mediaType === "video") {
    return NextResponse.json({ ok: false, error: "VIDEO_UPLOAD_REQUIRED" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const audience = body.audience == null ? "everyone" : String(body.audience)
  if (!["everyone", "followers", "friends", "matches-only", "private"].includes(audience)) {
    return NextResponse.json({ ok: false, error: "INVALID_AUDIENCE" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  // Authoritative expiry and identity always come from the server clock/session.
  const MAX_STORY_MS = 24 * 60 * 60 * 1000
  const now = Date.now()
  const requested = typeof body.expiresAt === "number" && body.expiresAt > now ? body.expiresAt : now + MAX_STORY_MS
  const expiresAt = Math.min(requested, now + MAX_STORY_MS)
  const serverProfile = await getServerProfile(auth.userId).catch(() => null)
  const row = {
    id: storyId,
    ownerId: auth.userId,
    ownerName: String(serverProfile?.displayName || serverProfile?.username || auth.username || "Member").trim().slice(0, 120) || "Member",
    ownerPhoto: String(serverProfile?.photos?.[0] || "").slice(0, 2000),
    text,
    mediaType,
    mediaUrl,
    background: typeof body.background === "string" && SAFE_STORY_BACKGROUNDS.has(body.background) ? body.background : null,
    audience,
    expiresAt,
    createdAt: now,
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
  const resultData = result.data as { ok?: boolean; error?: string; duplicate?: boolean; id?: string } | null
  if (resultData?.ok === false) {
    const error = String(resultData.error || "STORY_CREATE_FAILED")
    return NextResponse.json({ ok: false, error }, { status: error === "ID_CONFLICT" ? 409 : 400, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, durable: true, idempotent: Boolean(resultData?.duplicate), story: row }, { headers: { "Cache-Control": "no-store" } })
}
