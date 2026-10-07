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

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"])
const ALLOWED_FILE = new Set(["application/pdf", "application/x-pdf"])
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const MAX_FILE_BYTES = 8 * 1024 * 1024

function sniffKind(buf: Buffer): "image" | "video" | "file" | "unknown" {
  if (buf.length < 12) return "unknown"
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image"
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image"
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "file"
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "video"
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video"
  return "unknown"
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const url = new URL(request.url)
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
  const resolved = await resolveMediaAssets(auth.userId, ids)
  return NextResponse.json({
    ok: resolved.ok,
    assets: resolved.assets,
    error: resolved.error,
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`media-upload:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const env = readGhcServerEnv()
  const storageBucket = String(process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
  const hasStorage = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)

  const contentType = request.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
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
    return NextResponse.json(
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
    return NextResponse.json({ ok: false, error: "INVALID_FORM" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof Blob) || file.size <= 0) {
    return NextResponse.json({ ok: false, error: "FILE_REQUIRED" }, { status: 400 })
  }

  let mime = (file.type || "").toLowerCase()
  let isImage = ALLOWED_IMAGE.has(mime)
  let isVideo = ALLOWED_VIDEO.has(mime)
  let isFile = ALLOWED_FILE.has(mime)
  // Peek signature before trusting client MIME alone
  const head = Buffer.from(await file.slice(0, 16).arrayBuffer())
  const sniffed = sniffKind(head)
  if (!isImage && !isVideo && !isFile) {
    if (sniffed === "image") {
      isImage = true
      mime = mime || "image/jpeg"
    } else if (sniffed === "video") {
      isVideo = true
      mime = mime || "video/mp4"
    } else if (sniffed === "file") {
      isFile = true
      mime = "application/pdf"
    } else {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
    }
  } else if (sniffed !== "unknown") {
    // Reject MIME/signature mismatch for safety
    if (isImage && sniffed !== "image") {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
    }
    if (isVideo && sniffed !== "video") {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
    }
    if (isFile && sniffed !== "file") {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
    }
  }
  const maxBytes = isImage ? MAX_IMAGE_BYTES : isVideo ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 })
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
      const detail = await uploadRes.text().catch(() => "")
      return NextResponse.json(
        {
          ok: false,
          error: "STORAGE_UPLOAD_FAILED",
          message: "Object storage rejected the upload.",
          detail: detail.slice(0, 200),
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
      return NextResponse.json(
        {
          ok: false,
          error: "ASSET_RECORD_FAILED",
          message:
            "File may have been stored but durable asset record failed. Apply migration 20261001_gh_media_assets.sql.",
          detail: record.error,
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
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
    return NextResponse.json(
      {
        ok: false,
        error: "STORAGE_ERROR",
        message: e instanceof Error ? e.message : "Upload failed",
      },
      { status: 503 }
    )
  }
}
