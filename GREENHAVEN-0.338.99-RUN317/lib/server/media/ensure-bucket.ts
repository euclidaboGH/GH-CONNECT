/**
 * Ensure Supabase storage bucket exists (service role). Idempotent.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

export async function ensureMediaBucket(
  bucketName?: string
): Promise<{ ok: boolean; created?: boolean; error?: string; bucket: string }> {
  const env = readGhcServerEnv()
  const bucket = String(bucketName || process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "STORAGE_NOT_CONFIGURED", bucket }
  }
  const base = env.supabaseUrl.replace(/\/$/, "")
  const headers = {
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    apikey: env.supabaseServiceRoleKey,
    "Content-Type": "application/json",
  }
  try {
    const get = await fetch(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    if (get.ok) return { ok: true, created: false, bucket }

    // Create public=false bucket for owner-path objects
    const create = await fetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: false,
        file_size_limit: 52428800,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "audio/flac", "application/pdf"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    if (create.ok || create.status === 409) {
      return { ok: true, created: create.status !== 409, bucket }
    }
    const text = await create.text().catch(() => "")
    return {
      ok: false,
      error: `BUCKET_CREATE_${create.status}:${text.slice(0, 120)}`,
      bucket,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "BUCKET_NETWORK",
      bucket,
    }
  }
}
