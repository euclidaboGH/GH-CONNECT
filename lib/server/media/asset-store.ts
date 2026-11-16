/**
 * Durable media asset records via service-role RPC.
 * No economy coupling.
 */
import { randomUUID } from "node:crypto"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { isSafeMediaBucket, mediaCategoryMatches, mediaExtensionMatchesMime, parseOwnedMediaPath, validateMediaMetadata } from "@/lib/server/media/path-policy.mjs"
import { supabaseRpc, supabaseRest } from "@/lib/server/supabase/rest-client"

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
  id?: string
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
  const id = input.id || genMediaId()
  try {
    const res = await (async () => { const r = await supabaseRpc('gh_media_asset_create', typeof JSON.stringify({ === "string" ? JSON.parse(JSON.stringify({) : JSON.stringify({, { timeoutMs: 15000 }); return { ok: r.ok, status: r.status, json: async () => r.ok ? r.data : r.body, text: async () => JSON.stringify(r.ok ? r.data : r.body) }; })(),
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
    const res = await (async () => { const r = await supabaseRpc('gh_media_assets_resolve', typeof JSON.stringify({ p_actor_id: actorId === "string" ? JSON.parse(JSON.stringify({ p_actor_id: actorId) : JSON.stringify({ p_actor_id: actorId, { timeoutMs: 15000 }); return { ok: r.ok, status: r.status, json: async () => r.ok ? r.data : r.body, text: async () => JSON.stringify(r.ok ? r.data : r.body) }; })(),
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
