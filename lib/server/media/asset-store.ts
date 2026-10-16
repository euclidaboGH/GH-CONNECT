/**
 * Durable media asset records via service-role RPC.
 * No economy coupling.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

function genMediaId(): string {
  return `media_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
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
  // Enforce ownership path before RPC
  if (!input.storagePath.startsWith(`${input.ownerId}/`)) {
    return { ok: false, error: "PATH_OWNERSHIP" }
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
      }
    )
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || !data || data.ok === false) {
      return {
        ok: false,
        error: String((data && (data.error || data.message)) || `HTTP_${res.status}`),
      }
    }
    return { ok: true, id: String(data.id || id) }
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
