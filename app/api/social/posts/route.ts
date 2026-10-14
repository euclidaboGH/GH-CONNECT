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
    ? body.mediaIds.map(String).filter(Boolean).slice(0, 10)
    : []
  if (mediaIds.length > 0) {
    const resolved = await resolveMediaAssets(auth.userId, mediaIds)
    if (resolved.ok) {
      for (const a of resolved.assets) {
        const owned = a.owned === true
        const url = String(a.url || "")
        if (!owned && !url) continue
        if (!url) continue
        if (String(a.kind) === "video" && !videoFromMedia) {
          videoFromMedia = url
        } else if (String(a.kind) === "image" && isSafeImageRef(url) && images.length < 10) {
          images.push(url)
        }
      }
    }
  }

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

  return NextResponse.json({ ok: true, durable: true, post: row })
}
