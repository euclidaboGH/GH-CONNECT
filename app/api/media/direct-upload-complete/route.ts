/**
 * POST /api/media/direct-upload-complete
 * After the browser PUTs bytes to a signed storage URL, finalize the media asset record.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { createMediaAssetRecord } from "@/lib/server/media/asset-store"
import { isSafeMediaBucket, mediaCategoryMatches, mediaExtensionMatchesMime, parseOwnedMediaPath, validateMediaMetadata } from "@/lib/server/media/path-policy.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(body, { ...init, headers })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return jsonNoStore({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`media-complete:${auth.userId}`, 40, 60_000)
  if (!rl.ok) {
    return jsonNoStore({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const env = readGhcServerEnv()
  const storageBucket = String(process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return jsonNoStore({ ok: false, error: "MEDIA_STORAGE_UNAVAILABLE" }, { status: 501 })
  }
  if (!isSafeMediaBucket(storageBucket)) return jsonNoStore({ ok: false, error: "MEDIA_STORAGE_CONFIGURATION_INVALID" }, { status: 503 })

  const body = (await request.json().catch(() => ({}))) as {
    objectPath?: string
    bucket?: string
    mimeType?: string
    kind?: string
    byteSize?: number
    width?: number
    height?: number
    durationMs?: number
    uploadId?: string
  }

  const uploadId = String(body.uploadId || "").trim()
  if (!/^upload_[a-f0-9]{24,40}$/.test(uploadId)) return jsonNoStore({ ok: false, error: "INVALID_UPLOAD_ID" }, { status: 400 })
  const objectPath = String(body.objectPath || "")
  const parsedPath = parseOwnedMediaPath(auth.userId, objectPath)
  if (String(body.bucket || storageBucket) !== storageBucket || !parsedPath) {
    return jsonNoStore({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  const bucket = storageBucket
  const mime = String(body.mimeType || "").toLowerCase()
  let uploadSession: Record<string, unknown> | null = null
  try {
    const sessionRes = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_media_upload_session_get`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey!, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_upload_id: uploadId, p_owner_id: auth.userId }), cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    uploadSession = await sessionRes.json().catch(() => null) as Record<string, unknown> | null
    if (!sessionRes.ok || uploadSession?.ok !== true || String(uploadSession.storagePath || "") !== objectPath || String(uploadSession.bucket || "") !== bucket) {
      return jsonNoStore({ ok: false, error: "UPLOAD_SESSION_MISMATCH" }, { status: 403 })
    }
    if (String(uploadSession.status) === "finalized" && uploadSession.mediaId) {
      const origin = new URL(request.url).origin
      return jsonNoStore({ ok: true, durable: true, mediaId: String(uploadSession.mediaId), url: `${origin}/api/media/${encodeURIComponent(String(uploadSession.mediaId))}/content`, kind: String(uploadSession.mediaKind || "file"), mime: String(uploadSession.mimeType || mime), ownerUserId: auth.userId, idempotent: true })
    }
  } catch {
    return jsonNoStore({ ok: false, error: "UPLOAD_SESSION_UNAVAILABLE" }, { status: 503 })
  }
  const allowedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"])
  const allowedVideos = new Set(["video/mp4", "video/webm", "video/quicktime"])
  const allowedAudio = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "audio/flac"])
  const allowedFiles = new Set(["application/pdf"])
  const isImage = allowedImages.has(mime)
  const isVideo = allowedVideos.has(mime)
  const isAudio = allowedAudio.has(mime)
  const isFile = allowedFiles.has(mime)
  const byteSize = Number(body.byteSize)
  const maxBytes = isImage ? 25 * 1024 * 1024 : isVideo ? 40 * 1024 * 1024 : isAudio || isFile ? 25 * 1024 * 1024 : 0
  const category = parsedPath.category
  const expectedCategory = category === "avatars" && isImage ? "avatars" : isAudio ? "audio" : isFile ? "documents" : isVideo ? "videos" : isImage ? "images" : ""
  const kind = isVideo ? "video" : isImage ? "image" : "file"
  const metadataError = validateMediaMetadata({ mediaKind: kind, mimeType: mime, byteSize, width: body.width ?? null, height: body.height ?? null, durationMs: body.durationMs ?? null })
  if (!maxBytes || byteSize > maxBytes || !expectedCategory || category !== expectedCategory || !mediaCategoryMatches(category, kind, mime) || metadataError || !mediaExtensionMatchesMime(parsedPath.fileName, mime)) {
    return jsonNoStore({ ok: false, error: byteSize > maxBytes ? "FILE_TOO_LARGE" : metadataError || "INVALID_MEDIA_METADATA" }, { status: 400 })
  }

  // Verify object exists
  try {
    const head = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/info/${bucket}/${objectPath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      {
        headers: {
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          apikey: env.supabaseServiceRoleKey!,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    )
    if (!head.ok) {
      return jsonNoStore({ ok: false, error: "UPLOADED_OBJECT_NOT_VERIFIED", message: "Storage could not verify the uploaded object. Retry completion after confirming the upload." }, { status: 409 })
    }
    const info = await head.json().catch(() => null) as Record<string, unknown> | null
    const metadata = info && typeof info.metadata === "object" && info.metadata ? info.metadata as Record<string, unknown> : {}
    const storedSize = Number(info?.size ?? info?.contentLength ?? metadata.size ?? metadata.contentLength)
    const storedMime = String(info?.mimetype ?? info?.contentType ?? metadata.mimetype ?? metadata.contentType ?? "").toLowerCase()
    if (!Number.isSafeInteger(storedSize) || storedSize !== byteSize || (storedMime && storedMime !== mime)) {
      return jsonNoStore({ ok: false, error: "UPLOADED_OBJECT_METADATA_MISMATCH" }, { status: 409 })
    }
  } catch {
    return jsonNoStore({ ok: false, error: "UPLOADED_OBJECT_NOT_VERIFIED" }, { status: 503 })
  }

  const record = await createMediaAssetRecord({
    id: `media_${uploadId.slice(7)}`,
    ownerId: auth.userId,
    bucket,
    storagePath: objectPath,
    mediaKind: kind as "image" | "video" | "file",
    mimeType: mime,
    byteSize,
    width: typeof body.width === "number" ? body.width : null,
    height: typeof body.height === "number" ? body.height : null,
    durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
    publicUrl: null,
    metadata: { source: "api_media_direct_upload", delivery: "authorized-facade", category },
  })

  if (!record.ok || !record.id) {
    return jsonNoStore(
      {
        ok: false,
        error: "ASSET_RECORD_FAILED",
        message: "Upload received but media record could not be saved. Retry.",
      },
      { status: 503 }
    )
  }

  try {
    const finalizeRes = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_media_upload_session_finalize`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey!, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_upload_id: uploadId, p_owner_id: auth.userId, p_media_id: record.id }), cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    const finalized = await finalizeRes.json().catch(() => ({})) as Record<string, unknown>
    if (!finalizeRes.ok || finalized.ok !== true) return jsonNoStore({ ok: false, error: "UPLOAD_SESSION_FINALIZE_FAILED" }, { status: 503 })
  } catch {
    return jsonNoStore({ ok: false, error: "UPLOAD_SESSION_FINALIZE_FAILED" }, { status: 503 })
  }

  const origin = new URL(request.url).origin
  return jsonNoStore({
    ok: true,
    durable: true,
    mediaId: record.id,
    url: `${origin}/api/media/${encodeURIComponent(record.id)}/content`,
    kind,
    mime,
    ownerUserId: auth.userId,
  })
}
