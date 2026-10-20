/**
 * POST /api/media/direct-upload-complete
 * After the browser PUTs bytes to a signed storage URL, finalize the media asset record.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { createMediaAssetRecord } from "@/lib/server/media/asset-store"

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

  const body = (await request.json().catch(() => ({}))) as {
    objectPath?: string
    bucket?: string
    mimeType?: string
    kind?: string
    byteSize?: number
    width?: number
    height?: number
    durationMs?: number
  }

  const objectPath = String(body.objectPath || "").replace(/^\/+/, "")
  if (!objectPath.startsWith(`${auth.userId}/`)) {
    return jsonNoStore({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  const bucket = String(body.bucket || storageBucket)
  const mime = String(body.mimeType || "application/octet-stream")
  const kind =
    body.kind === "video" ? "video" : body.kind === "file" ? "file" : "image"

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
      }
    )
    // Some Supabase versions lack object/info — continue if 404 on info but upload succeeded
    void head
  } catch {
    /* best-effort */
  }

  const record = await createMediaAssetRecord({
    ownerId: auth.userId,
    bucket,
    storagePath: objectPath,
    mediaKind: kind as "image" | "video" | "file",
    mimeType: mime,
    byteSize: Number(body.byteSize) || 0,
    width: typeof body.width === "number" ? body.width : null,
    height: typeof body.height === "number" ? body.height : null,
    durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
    publicUrl: null,
    metadata: { source: "api_media_direct_upload", delivery: "authorized-facade" },
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
