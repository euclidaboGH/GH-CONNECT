/**
 * POST /api/media — durable media upload when Supabase storage is configured.
 * GET  /api/media?ids= — resolve owned/public media refs for the session actor.
 *
 * Owner is always session-derived. Paths: {userId}/{generated}.
 * No GHC/Pi/reputation side effects.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import {
  createMediaAssetRecord,
  resolveMediaAssets,
} from "@/lib/server/media/asset-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(body, { ...init, headers })
}

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"])
const ALLOWED_FILE = new Set(["application/pdf", "application/x-pdf"])
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const MAX_FILE_BYTES = 8 * 1024 * 1024

function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp"
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf"
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.subarray(8, 12).toString("ascii").toLowerCase()
    if (brand.startsWith("qt")) return "video/quicktime"
    // Do not classify every ISO-BMFF file as video: AVIF also uses an ftyp box.
    if (["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "m4v ", "m4a ", "msnv"].includes(brand) || brand.startsWith("3gp")) return "video/mp4"
    return null
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm"
  return null
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return jsonNoStore({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`media-resolve:${auth.userId}`, 120, 60_000)
  if (!rl.ok) {
    return jsonNoStore({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })
  }
  const url = new URL(request.url)
  const rawIds = (url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (rawIds.length > 20 || rawIds.some((id) => id.length > 240 || /[\u0000-\u001f\u007f]/.test(id) || id.includes("..") || id.startsWith("/"))) {
    return jsonNoStore({ ok: false, error: "INVALID_MEDIA_IDS" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const ids = rawIds
  const resolved = await resolveMediaAssets(auth.userId, ids)
  return jsonNoStore({
    ok: resolved.ok,
    assets: resolved.assets,
    error: resolved.ok ? undefined : "MEDIA_RESOLUTION_UNAVAILABLE",
  }, { status: resolved.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return jsonNoStore({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`media-upload:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return jsonNoStore({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const env = readGhcServerEnv()
  const storageBucket = String(process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
  const hasStorage = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)

  const contentType = (request.headers.get("content-type") || "").toLowerCase()
  const contentLength = Number(request.headers.get("content-length") || 0)
  // Leave room for multipart boundaries/metadata above the largest accepted file.
  if (Number.isFinite(contentLength) && contentLength > MAX_VIDEO_BYTES + 2 * 1024 * 1024) {
    return jsonNoStore({ ok: false, error: "REQUEST_TOO_LARGE", message: "This upload exceeds the supported request size." }, { status: 413 })
  }
  if (!contentType.includes("multipart/form-data")) {
    return jsonNoStore(
      {
        ok: false,
        error: "USE_MULTIPART",
        message:
          "Send multipart form field `file`. Without storage, compress on-device and use data:image on post create.",
        clientCompress: true,
      },
      { status: 400 }
    )
  }

  if (!hasStorage) {
    return jsonNoStore(
      {
        ok: false,
        error: "MEDIA_STORAGE_UNAVAILABLE",
        message:
          "Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and bucket GH_MEDIA_BUCKET (default gh-media). Until then use client compress + data URLs.",
        clientCompress: true,
      },
      { status: 501 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonNoStore({ ok: false, error: "INVALID_FORM" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof Blob) || file.size <= 0) {
    return jsonNoStore({ ok: false, error: "FILE_REQUIRED" }, { status: 400 })
  }

  let mime = (file.type || "").toLowerCase()
  // Validate actual bytes, not just the browser-provided MIME type.
  const head = Buffer.from(await file.slice(0, 16).arrayBuffer())
  const sniffedMime = sniffMime(head)
  if (!sniffedMime) {
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE", message: "The file signature is not a supported image, video or PDF." }, { status: 400 })
  }
  if (mime && mime !== sniffedMime) {
    // Normalize generic/incorrect client MIME values only when the bytes are a known supported format.
    const genericMime = mime === "application/octet-stream" || mime === "binary/octet-stream"
    if (genericMime || !(ALLOWED_IMAGE.has(mime) || ALLOWED_VIDEO.has(mime) || ALLOWED_FILE.has(mime))) {
      mime = sniffedMime
    } else {
      return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE", message: "The file type does not match its contents." }, { status: 400 })
    }
  } else {
    mime = sniffedMime
  }
  if (!ALLOWED_IMAGE.has(mime) && !ALLOWED_VIDEO.has(mime) && !ALLOWED_FILE.has(mime)) {
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
  }
  const isImage = ALLOWED_IMAGE.has(mime)
  const isVideo = ALLOWED_VIDEO.has(mime)
  const isFile = ALLOWED_FILE.has(mime)
  const maxBytes = isImage ? MAX_IMAGE_BYTES : isVideo ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
  if (file.size > maxBytes) {
    return jsonNoStore({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 })
  }

  // Ignore any client-supplied owner/path fields
  void form.get("ownerId")
  void form.get("path")
  void form.get("userId")

  const widthRaw = form.get("width")
  const heightRaw = form.get("height")
  const width =
    widthRaw != null && Number.isFinite(Number(widthRaw)) ? Math.max(0, Math.floor(Number(widthRaw))) : null
  const height =
    heightRaw != null && Number.isFinite(Number(heightRaw))
      ? Math.max(0, Math.floor(Number(heightRaw)))
      : null
  const durationRaw = form.get("durationMs")
  const durationMs =
    durationRaw != null && Number.isFinite(Number(durationRaw))
      ? Math.max(0, Math.floor(Number(durationRaw)))
      : null

  const ext = isFile
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
            : "jpg"

  const objectName = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const objectPath = `${auth.userId}/${objectName}`

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const uploadRes = await fetch(
      `${env.supabaseUrl!.replace(/\/$/, "")}/storage/v1/object/${storageBucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          apikey: env.supabaseServiceRoleKey!,
          "Content-Type": mime,
          "x-upsert": "false",
        },
        body: buf,
      }
    )
    if (!uploadRes.ok) {
      await uploadRes.text().catch(() => "")
      return jsonNoStore(
        {
          ok: false,
          error: "STORAGE_UPLOAD_FAILED",
          message: "Object storage rejected the upload.",
        },
        { status: 502 }
      )
    }

    // Public object URL when bucket is public; private buckets need signed URLs (deferred).
    const publicUrl = `${env.supabaseUrl!.replace(/\/$/, "")}/storage/v1/object/public/${storageBucket}/${objectPath}`

    const record = await createMediaAssetRecord({
      ownerId: auth.userId,
      bucket: storageBucket,
      storagePath: objectPath,
      mediaKind: isFile ? "file" : isVideo ? "video" : "image",
      mimeType: mime,
      byteSize: file.size,
      width,
      height,
      durationMs,
      publicUrl,
      metadata: { source: "api_media_upload" },
    })

    if (!record.ok) {
      return jsonNoStore(
        {
          ok: false,
          error: "ASSET_RECORD_FAILED",
          message:
            "File may have been stored but durable asset record failed. Apply migration 20261001_gh_media_assets.sql.",
        },
        { status: 503 }
      )
    }

    return jsonNoStore({
      ok: true,
      durable: true,
      mediaId: record.id,
      path: objectPath,
      url: publicUrl,
      kind: isFile ? "file" : isVideo ? "video" : "image",
      mime,
      ownerUserId: auth.userId,
      width,
      height,
      durationMs,
    })
  } catch (e) {
    return jsonNoStore(
      {
        ok: false,
        error: "STORAGE_ERROR",
        message: e instanceof Error ? e.message : "Upload failed",
      },
      { status: 503 }
    )
  }
}
