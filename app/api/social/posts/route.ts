/**
 * POST /api/social/posts — create post (author = session user only).
 * GET  /api/social/posts — feed alias.
 *
 * Media: accepts https URLs or compressed data:image/* URLs under size caps.
 * Rejects blob: and client ownership fields. Idempotent when client sends stable id.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { resolveMediaAssets } from "@/lib/server/media/asset-store"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { getServerProfile } from "@/lib/server/identity/profile-store"
import { hydratePublicProfileIdentity } from "@/lib/server/identity/public-profile-hydration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_DATA_URL_CHARS = 900_000
const MAX_HTTPS_URL = 2000

function genId(): string {
  return `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isSafeImageRef(ref: string): boolean {
  const s = String(ref || "").trim()
  if (!s || s.length > MAX_DATA_URL_CHARS) return false
  if (s.startsWith("blob:")) return false
  if (s.startsWith("data:image/")) return s.length <= MAX_DATA_URL_CHARS
  if (s.startsWith("https://")) return s.length <= MAX_HTTPS_URL
  return false
}

function isSafeVideoRef(ref: string | null): boolean {
  if (!ref) return true
  const s = String(ref).trim()
  if (!s) return true
  if (s.startsWith("blob:")) return false
  if (s.startsWith("data:video/")) return s.length <= 2_500_000
  if (s.startsWith("https://")) return s.length <= MAX_HTTPS_URL
  return false
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Posts list", { posts: [] })
    return NextResponse.json(nd.body, { status: nd.status })
  }
  const result = await socialRpc("gh_post_list_feed", {
    p_viewer_id: auth.userId,
    p_limit: 40,
    p_before_ms: null,
  })
  const payload = result.data as { posts?: unknown[] }
  const rawPosts = Array.isArray(payload?.posts) ? payload.posts : []
  const posts = await hydratePublicProfileIdentity(rawPosts.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")))
  return NextResponse.json({
    ok: true,
    durable: result.ok,
    posts,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`post-create:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const content = String(body.content || "").trim()
  const rawImages = Array.isArray(body.images) ? body.images.map(String).slice(0, 10) : []
  const images = rawImages.filter(isSafeImageRef)
  if (rawImages.length > 0 && images.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_MEDIA",
        message:
          "Images must be optimized data:image or https URLs. Blob URLs are not durable.",
      },
      { status: 400 }
    )
  }

  // Optional durable media IDs (session must own or public_url available)
  let videoFromMedia: string | null = null
  const mediaIds = Array.isArray(body.mediaIds)
    ? [...new Set(body.mediaIds.map(String).map((s) => s.trim()).filter(Boolean))].slice(0, 10)
    : []
  if (mediaIds.length > 0) {
    const resolved = await resolveMediaAssets(auth.userId, mediaIds)
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: "MEDIA_RESOLUTION_UNAVAILABLE" }, { status: 503 })
    }
    const byId = new Map(resolved.assets.map((a) => [String(a.id || ""), a]))
    for (const mediaId of mediaIds) {
      const asset = byId.get(mediaId)
      // Durable private attachments must belong to the authenticated author.
      if (!asset || asset.owned !== true || asset.status !== "ready") {
        return NextResponse.json({ ok: false, error: "MEDIA_NOT_OWNED_OR_READY" }, { status: 403 })
      }
      const url = `${new URL(request.url).origin}/api/media/${encodeURIComponent(mediaId)}/content`
      if (String(asset.kind) === "video" && !videoFromMedia) videoFromMedia = url
      else if (String(asset.kind) === "image" && images.length < 10) images.push(url)
    }
  }
  // Older composer versions only send the stable delivery URL. Recover the opaque media ID
  // from that first-party URL so the post gets a durable media relation as well.
  const mediaIdsFromUrls = [...images, ...(videoFromMedia ? [videoFromMedia] : [])]
    .map((value) => {
      try {
        const parsed = new URL(value, new URL(request.url).origin)
        const match = parsed.pathname.match(/^\/api\/media\/(media_[a-z0-9]+_[a-z0-9]+)\/content$/i)
        return parsed.origin === new URL(request.url).origin ? match?.[1] || "" : ""
      } catch { return "" }
    }).filter(Boolean)
  const durableMediaIds = [...new Set([...mediaIds, ...mediaIdsFromUrls])].slice(0, 20)

  const video = videoFromMedia || (body.video ? String(body.video) : null)
  if (video && !isSafeVideoRef(video)) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_VIDEO",
        message: "Video must be https or a bounded data:video URL. Blob URLs are not durable.",
      },
      { status: 400 }
    )
  }

  const pdf = body.pdf ? String(body.pdf) : null
  if (pdf && (pdf.startsWith("blob:") || pdf.length > 2_500_000)) {
    return NextResponse.json({ ok: false, error: "INVALID_ATTACHMENT" }, { status: 400 })
  }

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

  let contentType = body.contentType ? String(body.contentType).slice(0, 40) : "standard"
  if (!hasMedia && content.length > 0 && content.length <= 280 && contentType === "standard") {
    contentType = "status"
  }
  // Short-form: durable video with little/no image gallery
  if (
    contentType === "standard" &&
    Boolean(video) &&
    images.length === 0 &&
    !pdf
  ) {
    contentType = "short_video"
  }
  if (contentType === "reel") contentType = "short_video"

  const clientId = String(body.id || "").trim()
  const id =
    clientId && /^post_[a-zA-Z0-9_-]{6,80}$/.test(clientId) ? clientId : genId()

  // Quote reference: only accept a stable post id string (server does not trust client content of original)
  const quoteOfRaw = body.quoteOf != null ? String(body.quoteOf).trim() : ""
  const quoteOf =
    quoteOfRaw && /^[a-zA-Z0-9_-]{6,120}$/.test(quoteOfRaw) ? quoteOfRaw : null

  // Community posts: require active membership (session user) — never trust client role claims
  const communityId =
    body.communityId != null ? String(body.communityId).trim() : ""
  if (communityId) {
    if (!socialDbConfigured()) {
      return NextResponse.json(
        { ok: false, error: "SOCIAL_DB_UNAVAILABLE", durable: false },
        { status: 503 }
      )
    }
    const roleRes = await socialRpc("gh_community_member_role", {
      p_community_id: communityId,
      p_user_id: auth.userId,
    })
    const roleData = roleRes.data as {
      ok?: boolean
      role?: string
      status?: string
      error?: string
    }
    const status = String(roleData?.status || "").toLowerCase()
    const role = String(roleData?.role || "").toLowerCase()
    const activeMember =
      roleRes.ok &&
      (status === "active" || (!status && Boolean(role))) &&
      status !== "banned" &&
      status !== "pending" &&
      status !== "rejected"
    if (!activeMember) {
      return NextResponse.json(
        { ok: false, error: "NOT_A_MEMBER", message: "Join this community before posting." },
        { status: 403 }
      )
    }
  }

  // Presentation identity is server-derived. Never let a post creation request
  // impersonate another display name/avatar via client-supplied snapshot fields.
  const serverProfile = await getServerProfile(auth.userId).catch(() => null)
  const authorName = String(serverProfile?.displayName || serverProfile?.username || auth.username || "Member").slice(0, 120)
  const authorPhoto = String(serverProfile?.photos?.[0] || "").slice(0, 2000)

  const row = {
    id,
    authorId: auth.userId,
    authorName,
    authorPhoto,
    content,
    images,
    video,
    pdf,
    pdfName: body.pdfName ? String(body.pdfName).slice(0, 200) : null,
    visibility,
    listingId: body.listingId ? String(body.listingId) : null,
    listingKind: body.listingKind ? String(body.listingKind) : null,
    communityId: communityId || null,
    communityName: body.communityName ? String(body.communityName) : null,
    contentType,
    createdAt: Date.now(),
    ...(quoteOf ? { quoteOf } : {}),
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
    const err = String(data.error || "")
    if (err.toLowerCase().includes("duplicate") || err.toLowerCase().includes("unique")) {
      return NextResponse.json({ ok: true, durable: true, post: row, duplicate: true })
    }
    return NextResponse.json(
      { ok: false, error: data.error || "CREATE_REJECTED" },
      { status: 400 }
    )
  }

  // Persist durable media-ID references after post creation. The RPC re-checks author,
  // media ownership, readiness and deleted state in one database transaction. On failure,
  // hide the just-created post rather than leave an unauthorized half-published attachment.
  if (durableMediaIds.length > 0) {
    const { readGhcServerEnv } = await import("@/lib/server/economy/env")
    const env = readGhcServerEnv()
    let attached = false
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_post_media_attach`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
          body: JSON.stringify({ p_actor_id: auth.userId, p_post_id: id, p_media_ids: durableMediaIds }),
          cache: "no-store",
        })
        const result = await response.json().catch(() => null) as { ok?: boolean } | null
        attached = response.ok && result?.ok === true
      } catch { attached = false }
    }
    if (!attached) {
      if (env.supabaseUrl && env.supabaseServiceRoleKey) {
        await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts?id=eq.${encodeURIComponent(id)}&author_id=eq.${encodeURIComponent(auth.userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, Prefer: "return=minimal" },
          body: JSON.stringify({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
          cache: "no-store",
        }).catch(() => undefined)
      }
      return NextResponse.json({ ok: false, error: "MEDIA_ATTACH_FAILED", message: "The post was not published because media authorization could not be persisted." }, { status: 503 })
    }
  }

  // Best-effort attach quote_of_post_id when migration 56 is applied
  if (quoteOf) {
    try {
      const { readGhcServerEnv } = await import("@/lib/server/economy/env")
      const env = readGhcServerEnv()
      if (env.supabaseUrl && env.supabaseServiceRoleKey) {
        // Verify original exists and is not deleted
        const check = await fetch(
          `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts?id=eq.${encodeURIComponent(quoteOf)}&deleted_at=is.null&select=id&limit=1`,
          {
            headers: {
              apikey: env.supabaseServiceRoleKey,
              Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        )
        const found = (await check.json().catch(() => [])) as unknown[]
        if (Array.isArray(found) && found.length > 0) {
          await fetch(
            `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts?id=eq.${encodeURIComponent(id)}`,
            {
              method: "PATCH",
              headers: {
                apikey: env.supabaseServiceRoleKey,
                Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ quote_of_post_id: quoteOf }),
              cache: "no-store",
            }
          )
        }
      }
    } catch {
      /* column may not exist until migration 56 */
    }
  }

  // Durable post-created alerts go only to followers who are allowed to see
  // this post. The RPC skips blocked relationships and enforces mutual-only
  // visibility in SQL; community/private posts never fan out to all followers.
  if (!communityId && visibility !== "private") {
    const preview = content || (images.length ? "Shared a photo" : video ? "Shared a video" : "Shared a post")
    await socialRpc("gh_social_notify_post_followers", {
      p_author_id: auth.userId,
      p_post_id: id,
      p_body: preview.slice(0, 180),
      p_dedupe_key: `post_created:${id}`,
      p_visibility: visibility,
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true, durable: true, post: row })
}
