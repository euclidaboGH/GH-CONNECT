/**
 * POST /api/media/direct-upload-intent
 * Issues a short-lived signed upload URL so the browser can PUT large files
 * straight to Supabase Storage (bypasses the ~4.5MB Vercel body limit).
 */
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"])
const ALLOWED_FILE = new Set(["application/pdf", "application/x-pdf"])
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const MAX_FILE_BYTES = 25 * 1024 * 1024

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
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return jsonNoStore({ ok: false, error: "MEDIA_STORAGE_UNAVAILABLE" }, { status: 501 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    mimeType?: string
    byteSize?: number
    fileName?: string
  }
  const mime = String(body.mimeType || "").toLowerCase()
  const byteSize = Number(body.byteSize) || 0
  if (!mime || byteSize <= 0) {
    return jsonNoStore({ ok: false, error: "INVALID_FORM" }, { status: 400 })
  }

  const isImage = ALLOWED_IMAGE.has(mime)
  const isVideo = ALLOWED_VIDEO.has(mime)
  const isFile = ALLOWED_FILE.has(mime)
  if (!isImage && !isVideo && !isFile) {
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
  }
  const maxBytes = isImage ? MAX_IMAGE_BYTES : isVideo ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
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

  const objectName = `${randomUUID()}.${ext}`
  const objectPath = `${auth.userId}/${objectName}`
  const base = env.supabaseUrl.replace(/\/$/, "")

  try {
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

    return jsonNoStore({
      ok: true,
      durable: false,
      uploadUrl,
      token: signJson.token || null,
      objectPath,
      bucket: storageBucket,
      mimeType: mime,
      kind: isFile ? "file" : isVideo ? "video" : "image",
      maxBytes,
    })
  } catch {
    return jsonNoStore({ ok: false, error: "STORAGE_ERROR" }, { status: 503 })
  }
}
