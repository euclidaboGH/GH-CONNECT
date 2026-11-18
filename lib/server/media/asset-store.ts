/** Durable media asset records via tightly-scoped service-role RPCs. */
import { randomUUID } from "node:crypto"
import { isSafeMediaBucket, mediaCategoryMatches, mediaExtensionMatchesMime, parseOwnedMediaPath, validateMediaMetadata } from "@/lib/server/media/path-policy.mjs"
import { supabaseRpc } from "@/lib/server/supabase/rest-client"

function genMediaId(): string {
  return `media_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "")}`
}

export async function createMediaAssetRecord(input: {
  ownerId: string; bucket: string; storagePath: string; mediaKind: "image" | "video" | "file"
  mimeType: string; byteSize: number; width?: number | null; height?: number | null
  durationMs?: number | null; publicUrl?: string | null; thumbPath?: string | null
  thumbUrl?: string | null; metadata?: Record<string, unknown>; id?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
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
  const id = input.id || genMediaId()
  const result = await supabaseRpc<Record<string, unknown>>("gh_media_asset_create", {
    p_id: id, p_owner_id: input.ownerId, p_bucket: input.bucket, p_storage_path: input.storagePath,
    p_media_kind: input.mediaKind, p_mime_type: input.mimeType, p_byte_size: input.byteSize,
    p_width: input.width ?? null, p_height: input.height ?? null, p_duration_ms: input.durationMs ?? null,
    p_public_url: input.publicUrl ?? null, p_thumb_path: input.thumbPath ?? null,
    p_thumb_url: input.thumbUrl ?? null, p_metadata: input.metadata ?? {},
  }, { timeoutMs: 15_000 })
  if (!result.ok) return { ok: false, error: result.error }
  if (result.data?.ok !== true || typeof result.data.id !== "string") {
    return { ok: false, error: String(result.data?.error || "ASSET_RECORD_REJECTED") }
  }
  return { ok: true, id: result.data.id }
}

export async function resolveMediaAssets(actorId: string, ids: string[]): Promise<{ ok: boolean; assets: Array<Record<string, unknown>>; error?: string }> {
  const clean = [...new Set(ids.map(String).filter((id) => /^media_[a-z0-9]+_[a-z0-9]+$/i.test(id)))].slice(0, 20)
  if (!clean.length) return { ok: true, assets: [] }
  const result = await supabaseRpc<Record<string, unknown>>("gh_media_assets_resolve", { p_actor_id: actorId, p_ids: clean }, { timeoutMs: 15_000 })
  if (!result.ok) return { ok: false, assets: [], error: result.error }
  if (result.data?.ok !== true) return { ok: false, assets: [], error: String(result.data?.error || "MEDIA_RESOLVE_FAILED") }
  return { ok: true, assets: Array.isArray(result.data.assets) ? result.data.assets as Array<Record<string, unknown>> : [] }
}
