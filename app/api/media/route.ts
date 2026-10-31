/**
 * POST /api/media — durable media upload when Supabase storage is configured.
 * GET  /api/media?ids= — resolve owned/public media refs for the session actor.
 *
 * Owner is always session-derived. Paths: {userId}/{category}/{generated}.
 * No GHC/Pi/reputation side effects.
 */
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { ensureMediaBucket } from "@/lib/server/media/ensure-bucket"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { buildOwnedMediaPath, isSafeMediaBucket, MAX_MEDIA_BYTES, maxMediaBytesForMime } from "@/lib/server/media/path-policy.mjs"
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

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"])
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"])
const ALLOWED_FILE = new Set(["application/pdf"])
const ALLOWED_AUDIO = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "audio/flac"])

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
    if (brand === "avif" || brand === "avis") return "image/avif"
    if (["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "m4v ", "msnv"].includes(brand) || brand.startsWith("3gp")) return "video/mp4"
    if (brand === "m4a " || brand === "mp4a") return "audio/mp4"
    return null
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm"
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav"
  if (buf.subarray(0, 4).toString("ascii") === "fLaC") return "audio/flac"
  if (buf.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg"
  if ((buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0)) return "audio/aac"
  if (buf.subarray(0, 3).toString("ascii") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "audio/mpeg"
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.subarray(8, 12).toString("ascii").toLowerCase()
    if (["m4a ", "mp4a"].includes(brand)) return "audio/mp4"
    if (brand === "avif" || brand === "avis") return "image/avif"
  }
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
  // Bucket names come from operator configuration, but still validate before URL construction.
  if (!isSafeMediaBucket(storageBucket)) {
    return jsonNoStore({ ok: false, error: "MEDIA_STORAGE_CONFIGURATION_INVALID" }, { status: 503 })
  }
  const hasStorage = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)

  const contentType = (request.headers.get("content-type") || "").toLowerCase()
  const rawContentLength = request.headers.get("content-length")
  // Multipart uploads are buffered by request.formData(); require a trustworthy
  // declared length so chunked/invalid-length requests cannot bypass the preflight cap.
  if (rawContentLength === null) {
    return jsonNoStore({ ok: false, error: "CONTENT_LENGTH_REQUIRED", message: "Use direct upload for clients that cannot provide a content length." }, { status: 411 })
  }
  if (!/^\d+$/.test(rawContentLength)) {
    return jsonNoStore({ ok: false, error: "INVALID_CONTENT_LENGTH" }, { status: 400 })
  }
  const contentLength = Number(rawContentLength)
  // Leave room for multipart boundaries/metadata above the largest accepted file.
  if (!Number.isSafeInteger(contentLength) || contentLength > MAX_MEDIA_BYTES + 2 * 1024 * 1024) {
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
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE", message: "The file signature is not a supported image, video, audio file or PDF." }, { status: 400 })
  }
  if (mime && mime !== sniffedMime && !(mime === "audio/webm" && sniffedMime === "video/webm")) {
    // Normalize generic/incorrect client MIME values only when the bytes are a known supported format.
    const genericMime = mime === "application/octet-stream" || mime === "binary/octet-stream"
    if (genericMime || !(ALLOWED_IMAGE.has(mime) || ALLOWED_VIDEO.has(mime) || ALLOWED_FILE.has(mime) || ALLOWED_AUDIO.has(mime))) {
      mime = sniffedMime
    } else {
      return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE", message: "The file type does not match its contents." }, { status: 400 })
    }
  } else if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") {
    mime = sniffedMime
  }
  if (!ALLOWED_IMAGE.has(mime) && !ALLOWED_VIDEO.has(mime) && !ALLOWED_FILE.has(mime) && !ALLOWED_AUDIO.has(mime)) {
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_TYPE" }, { status: 400 })
  }
  const isImage = ALLOWED_IMAGE.has(mime)
  const isVideo = ALLOWED_VIDEO.has(mime)
  const isFile = ALLOWED_FILE.has(mime)
  const isAudio = ALLOWED_AUDIO.has(mime)
  const maxBytes = maxMediaBytesForMime(mime)
  if (file.size > maxBytes) {
    return jsonNoStore({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 })
  }

  // Ignore any client-supplied owner/path fields
  void form.get("ownerId")
  void form.get("path")
  void form.get("userId")

  const widthRaw = form.get("width")
  const heightRaw = form.get("height")
  const parseBoundedInteger = (raw: FormDataEntryValue | null, max: number) => {
    if (raw == null || raw === "") return { value: null as number | null, valid: true }
    if (typeof raw !== "string" || !/^\d+$/.test(raw)) return { value: null, valid: false }
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < 0 || value > max) return { value: null, valid: false }
    return { value, valid: true }
  }
  const parsedWidth = parseBoundedInteger(form.get("width"), 20_000)
  const parsedHeight = parseBoundedInteger(form.get("height"), 20_000)
  const parsedDuration = parseBoundedInteger(form.get("durationMs"), 12 * 60 * 60 * 1000)
  if (!parsedWidth.valid || !parsedHeight.valid || !parsedDuration.valid) {
    return jsonNoStore({ ok: false, error: "INVALID_MEDIA_METADATA" }, { status: 400 })
  }
  const width = parsedWidth.value
  const height = parsedHeight.value
  const durationMs = parsedDuration.value

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

  const objectName = `${randomUUID()}.${ext}`
  const requestedCategory = String(form.get("category") || "").toLowerCase()
  const category = requestedCategory === "avatars" && isImage ? "avatars" : isAudio ? "audio" : isFile ? "documents" : isVideo ? "videos" : "images"
  const objectPath = buildOwnedMediaPath(auth.userId, category, objectName)
  if (!objectPath) return jsonNoStore({ ok: false, error: "MEDIA_PATH_INVALID" }, { status: 400 })

  // Provisioning is a side effect; defer it until the request, file signature,
  // MIME type, size and metadata have all passed validation.
  try {
    const ensured = await ensureMediaBucket(storageBucket)
    if (!ensured.ok) {
      return jsonNoStore(
        {
          ok: false,
          error: "MEDIA_STORAGE_CONFIGURATION_INVALID",
          message: ensured.error || "Storage bucket could not be prepared.",
          clientCompress: true,
        },
        { status: 503 }
      )
    }
  } catch {
    /* continue — upload may still work if bucket already exists */
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const uploadRes = await fetch(
      `${env.supabaseUrl!.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(storageBucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          apikey: env.supabaseServiceRoleKey!,
          "Content-Type": mime,
          "x-upsert": "false",
        },
        body: buf,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
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

    // New records never persist a public storage URL. The application delivery facade
    // performs viewer authorization and issues short-lived signed URLs on demand.
    const record = await createMediaAssetRecord({
      ownerId: auth.userId,
      bucket: storageBucket,
      storagePath: objectPath,
      mediaKind: isFile || isAudio ? "file" : isVideo ? "video" : "image",
      mimeType: mime,
      byteSize: file.size,
      width,
      height,
      durationMs,
      publicUrl: null,
      metadata: { source: "api_media_upload", delivery: "authorized-facade", category },
    })

    if (!record.ok || !record.id) {
      // Compensate for a successful object upload when durable metadata creation fails.
      // This avoids leaving an untracked object behind. Cleanup is best-effort: never
      // replace the primary failure with a storage cleanup error or expose credentials.
      try {
        await fetch(
          `${env.supabaseUrl!.replace(/\/$/, "")}/storage/v1/object/${storageBucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
              apikey: env.supabaseServiceRoleKey!,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(8_000),
          }
        )
      } catch {
        // A scheduled storage reconciliation can remove any object left by a failed cleanup.
      }
      return jsonNoStore(
        {
          ok: false,
          error: "ASSET_RECORD_FAILED",
          message:
            "The upload could not be finalized because its media record was not saved. Please retry.",
        },
        { status: 503 }
      )
    }

    return jsonNoStore({
      ok: true,
      durable: true,
      mediaId: record.id,
      // Only the opaque ID and stable application URL leave the server; storage paths are private.
      url: `${new URL(request.url).origin}/api/media/${encodeURIComponent(record.id)}/content`,
      kind: isFile || isAudio ? "file" : isVideo ? "video" : "image",
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
        message: "The media service could not complete this upload. Please try again.",
      },
      { status: 503 }
    )
  }
}
