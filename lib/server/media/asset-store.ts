/**
 * Durable media asset records via service-role RPC.
 * No economy coupling.
 */
import { randomUUID } from "node:crypto"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { isSafeMediaBucket, mediaCategoryMatches, mediaExtensionMatchesMime, parseOwnedMediaPath, validateMediaMetadata } from "@/lib/server/media/path-policy.mjs"

function genMediaId(): string {
  return `media_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "")}`
}

export async function createMediaAssetRecord(input: {
  ownerId: string
  bucket: string
  storagePath: string
  mediaKind: "image" | "video" | "file"
  mimeType: string
  byteSize: number
  width?: number | null
  height?: number | null
  durationMs?: number | null
  publicUrl?: string | null
  thumbPath?: string | null
  thumbUrl?: string | null
  metadata?: Record<string, unknown>
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "DB_UNAVAILABLE" }
  }
  // The database constraint and viewer authorization RPC both require owner/category/object.
  const parsedPath = parseOwnedMediaPath(input.ownerId, input.storagePath)
  if (!parsedPath) return { ok: false, error: "PATH_OWNERSHIP_OR_SHAPE" }
  if (!isSafeMediaBucket(input.bucket)) return { ok: false, error: "INVALID_BUCKET" }
  const metadataError = validateMediaMetadata(input)
  if (metadataError) return { ok: false, error: metadataError }
  if (!mediaCategoryMatches(parsedPath.category, input.mediaKind, input.mimeType)) return { ok: false, error: "MEDIA_CATEGORY_KIND_MISMATCH" }
  if (!mediaExtensionMatchesMime(parsedPath.fileName, input.mimeType)) return { ok: false, error: "FILE_EXTENSION_MIME_MISMATCH" }
  if (input.publicUrl != null) {
    try { if (new URL(input.publicUrl).protocol !== "https:") return { ok: false, error: "INVALID_PUBLIC_URL" } }
    catch { return { ok: false, error: "INVALID_PUBLIC_URL" } }
  }
  const id = genMediaId()
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_media_asset_create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_id: id,
          p_owner_id: input.ownerId,
          p_bucket: input.bucket,
          p_storage_path: input.storagePath,
          p_media_kind: input.mediaKind,
          p_mime_type: input.mimeType,
          p_byte_size: input.byteSize,
          p_width: input.width ?? null,
          p_height: input.height ?? null,
          p_duration_ms: input.durationMs ?? null,
          p_public_url: input.publicUrl ?? null,
          p_thumb_path: input.thumbPath ?? null,
          p_thumb_url: input.thumbUrl ?? null,
          p_metadata: input.metadata || {},
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    )
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (res.ok && data && data.ok === true && typeof data.id === "string") {
      return { ok: true, id: data.id }
    }
    // Do not bypass a rejected/missing RPC with a direct service-role table insert.
    // That fallback could turn a failed validation or unapplied schema into a ready asset.
    const error = data && typeof data.error === "string" ? data.error : `HTTP_${res.status}`
    return { ok: false, error: `ASSET_RECORD_FAILED:${error}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "RPC_FAILED" }
  }
}

export async function resolveMediaAssets(
  actorId: string,
  ids: string[]
): Promise<{ ok: boolean; assets: Array<Record<string, unknown>>; error?: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, assets: [], error: "DB_UNAVAILABLE" }
  }
  const clean = ids.map(String).filter(Boolean).slice(0, 20)
  if (clean.length === 0) return { ok: true, assets: [] }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_media_assets_resolve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({ p_actor_id: actorId, p_ids: clean }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    )
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean
      assets?: unknown
      error?: string
    } | null
    if (!res.ok || !data || data.ok === false) {
      return {
        ok: false,
        assets: [],
        error: String((data && data.error) || `HTTP_${res.status}`),
      }
    }
    return {
      ok: true,
      assets: Array.isArray(data.assets) ? (data.assets as Array<Record<string, unknown>>) : [],
    }
  } catch (e) {
    return {
      ok: false,
      assets: [],
      error: e instanceof Error ? e.message : "RPC_FAILED",
    }
  }
}
