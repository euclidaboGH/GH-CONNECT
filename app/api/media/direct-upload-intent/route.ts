/**
 * POST /api/media/direct-upload-intent
 * Issues a short-lived signed upload URL so the browser can PUT large files
 * straight to Supabase Storage (bypasses the ~4.5MB Vercel body limit).
 */
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { ensureMediaBucket } from "@/lib/server/media/ensure-bucket"
import { buildOwnedMediaPath, isSafeMediaBucket, maxMediaBytesForMime } from "@/lib/server/media/path-policy.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"])
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"])
const ALLOWED_FILE = new Set(["application/pdf"])
const ALLOWED_AUDIO = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "audio/flac"])

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
  const rl = checkRateLimit(`media-intent:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return jsonNoStore(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    )
  }

  const env = readGhcServerEnv()
  const storageBucket = String(process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
  if (!isSafeMediaBucket(storageBucket)) {
    return jsonNoStore({ ok: false, error: "MEDIA_STORAGE_CONFIGURATION_INVALID" }, { status: 503 })
  }

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return jsonNoStore({ ok: false, error: "MEDIA_STORAGE_UNAVAILABLE" }, { status: 501 })
  }

  const maxBodyBytes = 8 * 1024
  const parsed = await readBoundedJson(request, maxBodyBytes)
  if (!parsed.ok) {
    const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
    return jsonNoStore({ ok: false, error: parsed.error }, { status })
  }
  const parsedBody = parsed.value
  const body = parsedBody as {
    mimeType?: string
    byteSize?: number
    fileName?: string
    category?: string
  }
  const mime = String(body.mimeType || "").toLowerCase()
  const byteSize = Number(body.byteSize)
  if (!mime || !Number.isSafeInteger(byteSize) || byteSize <= 0) {
    return jsonNoStore({ ok: false, error: "INVALID_FORM" }, { status: 400 })
  }

  const isImage = ALLOWED_IMAGE.has(mime)
  const isVideo = ALLOWED_VIDEO.has(mime)
  const isFile = ALLOWED_FILE.has(mime)
  const isAudio = ALLOWED_AUDIO.has(mime)
  if (!isImage && !isVideo && !isFile && !isAudio) {
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
  }
  const maxBytes = maxMediaBytesForMime(mime)
  if (byteSize > maxBytes) {
    return jsonNoStore(
      {
        ok: false,
        error: "FILE_TOO_LARGE",
        message: `Maximum is ${Math.round(maxBytes / (1024 * 1024))}MB for this type.`,
      },
      { status: 400 }
    )
  }

  // Only attempt bucket provisioning after the authenticated request is bounded and valid.
  // The diagnostic GET endpoint is read-only and never provisions infrastructure.
  await ensureMediaBucket(storageBucket)

  const ext = isAudio
    ? (mime === "audio/mpeg" ? "mp3" : mime === "audio/mp4" ? "m4a" : mime === "audio/aac" ? "aac" : mime === "audio/ogg" ? "ogg" : mime === "audio/wav" ? "wav" : mime === "audio/flac" ? "flac" : "webm")
    : isFile
    ? "pdf"
    : isVideo
      ? mime === "video/webm"
        ? "webm"
        : mime === "video/quicktime"
          ? "mov"
          : "mp4"
      : mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : mime === "image/gif"
            ? "gif"
            : mime === "image/avif"
              ? "avif"
              : "jpg"

  const requestedCategory = String(body.category || "").toLowerCase()
  const category = requestedCategory === "avatars" && isImage ? "avatars" : isAudio ? "audio" : isFile ? "documents" : isVideo ? "videos" : "images"
  const uploadId = `upload_${randomUUID().replace(/-/g, "")}`
  const objectName = `${randomUUID()}.${ext}`
  const objectPath = buildOwnedMediaPath(auth.userId, category, objectName)
  if (!objectPath) return jsonNoStore({ ok: false, error: "MEDIA_PATH_INVALID" }, { status: 400 })
  const base = env.supabaseUrl.replace(/\/$/, "")

  try {
    const sessionRes = await fetch(`${base}/rest/v1/rpc/gh_media_upload_session_create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey!, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({
        p_upload_id: uploadId, p_owner_id: auth.userId, p_bucket: storageBucket, p_storage_path: objectPath,
        p_category: category, p_mime_type: mime, p_media_kind: isFile || isAudio ? "file" : isVideo ? "video" : "image",
        p_expected_bytes: byteSize, p_metadata: { source: "direct_upload_v2" },
      }), cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    const session = await sessionRes.json().catch(() => ({})) as Record<string, unknown>
    if (!sessionRes.ok || session.ok !== true) return jsonNoStore({ ok: false, error: "UPLOAD_SESSION_UNAVAILABLE" }, { status: 503 })
    // Supabase Storage: create signed upload URL (token for client PUT/POST)
    const signRes = await fetch(
      `${base}/storage/v1/object/upload/sign/${storageBucket}/${objectPath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          apikey: env.supabaseServiceRoleKey!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      }
    )
    const signJson = (await signRes.json().catch(() => ({}))) as {
      url?: string
      token?: string
      error?: string
      message?: string
    }
    if (!signRes.ok || !signJson.url) {
      // Fallback: some projects use signed URL query token shape
      return jsonNoStore(
        {
          ok: false,
          error: "STORAGE_ERROR",
          message: "Could not prepare direct upload. Try a smaller file or retry.",
        },
        { status: 502 }
      )
    }

    const relative = String(signJson.url)
    const uploadUrl = relative.startsWith("http")
      ? relative
      : `${base}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`
    let parsedUploadUrl: URL
    try { parsedUploadUrl = new URL(uploadUrl) }
    catch { return jsonNoStore({ ok: false, error: "SIGNED_UPLOAD_URL_INVALID" }, { status: 502 }) }
    if (
      parsedUploadUrl.protocol !== "https:" ||
      parsedUploadUrl.origin !== new URL(base).origin ||
      !parsedUploadUrl.pathname.startsWith("/storage/v1/object/upload/sign/")
    ) {
      return jsonNoStore({ ok: false, error: "SIGNED_UPLOAD_URL_UNTRUSTED" }, { status: 502 })
    }

    return jsonNoStore({
      ok: true,
      durable: false,
      uploadId,
      uploadUrl,
      token: signJson.token || null,
      objectPath,
      bucket: storageBucket,
      mimeType: mime,
      kind: isFile || isAudio ? "file" : isVideo ? "video" : "image",
      maxBytes,
    })
  } catch {
    return jsonNoStore({ ok: false, error: "STORAGE_ERROR" }, { status: 503 })
  }
}
