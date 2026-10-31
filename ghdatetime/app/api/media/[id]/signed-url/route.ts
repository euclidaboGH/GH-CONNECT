/**
 * GET /api/media/:id/signed-url
 * Issues a short-lived URL only after database authorization for the actual session viewer.
 * The service-role key never leaves the server; responses are never cacheable.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { canViewSocialPost } from "@/lib/server/social/post-visibility"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })
}

async function authorizeCommentAttachment(
  base: string,
  serviceKey: string,
  mediaId: string,
  viewerId: string,
): Promise<{ ok: true; asset: { ok: true; mediaId: string; ownerId: string; bucket: string; storagePath: string; mime?: string; kind?: string } } | { ok: false; unavailable: boolean }> {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  try {
    const assetQuery = new URLSearchParams({
      id: `eq.${mediaId}`, status: "eq.ready", deleted_at: "is.null",
      select: "id,owner_id,bucket,storage_path,mime_type,media_kind", limit: "1",
    })
    const assetResponse = await fetch(`${base}/rest/v1/gh_media_assets?${assetQuery.toString()}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    if (!assetResponse.ok) return { ok: false, unavailable: true }
    const assets = await assetResponse.json() as Array<{ id?: string; owner_id?: string; bucket?: string; storage_path?: string; mime_type?: string; media_kind?: string }>
    const asset = assets[0]
    if (!asset?.id || !asset.owner_id || !asset.bucket || !asset.storage_path) return { ok: false, unavailable: false }
    const mediaFilter = JSON.stringify([{ id: mediaId }])
    const commentQuery = new URLSearchParams({
      deleted_at: "is.null", media: `cs.${mediaFilter}`,
      select: "post_id,author_id,media", limit: "20",
    })
    const commentResponse = await fetch(`${base}/rest/v1/gh_post_comments?${commentQuery.toString()}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    if (!commentResponse.ok) return { ok: false, unavailable: true }
    const comments = await commentResponse.json() as Array<{ post_id?: string; author_id?: string; media?: Array<{ id?: string }> }>
    for (const comment of comments) {
      if (comment.author_id !== asset.owner_id || !comment.post_id || !Array.isArray(comment.media) || !comment.media.some((item) => item?.id === mediaId)) continue
      const visible = await canViewSocialPost(viewerId, comment.post_id)
      if (visible === null) return { ok: false, unavailable: true }
      if (visible) {
        return { ok: true, asset: {
          ok: true, mediaId: asset.id, ownerId: asset.owner_id, bucket: asset.bucket,
          storagePath: asset.storage_path, mime: asset.mime_type, kind: asset.media_kind,
        } }
      }
    }
    return { ok: false, unavailable: false }
  } catch {
    return { ok: false, unavailable: true }
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)

  const limit = checkRateLimit(`media-sign:${auth.userId}`, 60, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

  const { id } = await context.params
  if (!/^media_[a-z0-9]+_[a-z0-9]+$/i.test(id) || id.length > 100) {
    return reply({ ok: false, error: "INVALID_MEDIA_ID" }, 400)
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return reply({ ok: false, error: "MEDIA_STORAGE_UNAVAILABLE" }, 503)
  }

  try {
    const base = env.supabaseUrl.replace(/\/$/, "")
    // Authorization is against the actual session viewer and current post visibility,
    // not merely the media owner. Unknown and unauthorized IDs share a 404 response.
    const authz = await fetch(`${base}/rest/v1/rpc/gh_media_authorize_viewer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_media_id: id, p_viewer_id: auth.userId }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    if (!authz.ok) return reply({ ok: false, error: "MEDIA_AUTHORIZATION_UNAVAILABLE" }, 503)
    let asset = await authz.json() as {
      ok?: boolean; error?: string; mediaId?: string; ownerId?: string;
      bucket?: string; storagePath?: string; mime?: string; kind?: string;
    }
    if (!asset || asset.ok !== true || asset.mediaId !== id || !asset.ownerId || !asset.bucket || !asset.storagePath) {
      // Comment media references are stored on the comment rather than gh_post_media.
      // Resolve them against the current comment and parent-post visibility at read time.
      const fallback = await authorizeCommentAttachment(base, env.supabaseServiceRoleKey, id, auth.userId)
      if (!fallback.ok) {
        return reply({ ok: false, error: fallback.unavailable ? "MEDIA_AUTHORIZATION_UNAVAILABLE" : "MEDIA_NOT_FOUND" }, fallback.unavailable ? 503 : 404)
      }
      asset = fallback.asset
    }
    // Revalidate the RPC/fallback payload after assignment. The RPC schema is
    // intentionally optional at the network boundary, so never rely on narrowing
    // from the earlier branch when constructing a storage path.
    const ownerId = asset.ownerId
    const bucketName = asset.bucket
    const storagePath = asset.storagePath
    if (
      typeof ownerId !== "string" || !ownerId ||
      typeof bucketName !== "string" || !bucketName ||
      typeof storagePath !== "string" || !storagePath ||
      !storagePath.startsWith(`${ownerId}/`) || storagePath.includes("..") ||
      storagePath.startsWith("/") || storagePath.split("/").some((part) => !part || part === ".")
    ) {
      return reply({ ok: false, error: "MEDIA_RECORD_INVALID" }, 503)
    }

    const bucket = encodeURIComponent(bucketName)
    const objectPath = storagePath.split("/").map((part) => encodeURIComponent(part)).join("/")
    const signed = await fetch(`${base}/storage/v1/object/sign/${bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 300 }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    const rawBody = await signed.text()
    let payload: {
      signedURL?: string
      signedUrl?: string
      url?: string
      error?: string | { message?: string }
      message?: string
      statusCode?: string | number
    } = {}
    try {
      payload = rawBody ? JSON.parse(rawBody) as typeof payload : {}
    } catch {
      payload = {}
    }
    if (!signed.ok) {
      const detail =
        (typeof payload.message === "string" && payload.message) ||
        (typeof payload.error === "string" && payload.error) ||
        (payload.error && typeof payload.error === "object" && typeof payload.error.message === "string"
          ? payload.error.message
          : null) ||
        `HTTP_${signed.status}`
      // Surface a stable code plus non-secret detail so operators can see Object not found / JWT etc.
      return reply(
        { ok: false, error: "MEDIA_SIGNING_UNAVAILABLE", detail: String(detail).slice(0, 180), status: signed.status },
        503,
      )
    }

    // Supabase Storage has returned several shapes across versions:
    // - { signedURL: "/storage/v1/object/sign/..." }
    // - { signedURL: "/object/sign/..." }
    // - { signedUrl: "https://xxx.supabase.co/storage/v1/object/sign/..." }
    // - { url: "..." } (rare / client-shaped)
    const candidate =
      (typeof payload.signedURL === "string" && payload.signedURL) ||
      (typeof payload.signedUrl === "string" && payload.signedUrl) ||
      (typeof payload.url === "string" && payload.url) ||
      ""

    const trustedOrigin = new URL(base).origin
    let absolute: string | null = null
    if (candidate.startsWith("https://")) {
      try {
        const u = new URL(candidate)
        if (u.origin === trustedOrigin && u.pathname.includes("/object/sign/")) {
          absolute = u.toString()
        }
      } catch {
        absolute = null
      }
    } else if (candidate.startsWith("/storage/v1/object/sign/")) {
      absolute = `${base}${candidate}`
    } else if (candidate.startsWith("/object/sign/")) {
      absolute = `${base}/storage/v1${candidate}`
    } else if (candidate.startsWith("storage/v1/object/sign/")) {
      absolute = `${base}/${candidate}`
    } else if (candidate.startsWith("object/sign/")) {
      absolute = `${base}/storage/v1/${candidate}`
    }

    if (!absolute) {
      return reply(
        {
          ok: false,
          error: "MEDIA_SIGNING_INVALID_RESPONSE",
          detail: "Unexpected signed-url shape from storage",
          keys: Object.keys(payload).slice(0, 8),
        },
        502,
      )
    }

    try {
      const check = new URL(absolute)
      if (check.protocol !== "https:" || check.origin !== trustedOrigin || !check.pathname.includes("/object/sign/")) {
        return reply({ ok: false, error: "MEDIA_SIGNING_INVALID_RESPONSE", detail: "Untrusted signed origin" }, 502)
      }
    } catch {
      return reply({ ok: false, error: "MEDIA_SIGNING_INVALID_RESPONSE", detail: "Malformed signed url" }, 502)
    }

    return reply({
      ok: true,
      mediaId: asset.mediaId,
      url: absolute,
      expiresIn: 300,
      mime: asset.mime,
    })
  } catch {
    return reply({ ok: false, error: "MEDIA_SIGNING_UNAVAILABLE", detail: "SIGN_EXCEPTION" }, 503)
  }
}
