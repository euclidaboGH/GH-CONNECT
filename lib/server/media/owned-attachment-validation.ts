import { readGhcServerEnv } from "@/lib/server/economy/env"
import {
  reconcileAttachmentWithAsset, sanitizeAttachmentFileName, type DurableAttachment,
} from "@/lib/server/media/message-attachment-policy"

export type { DurableAttachment }


/**
 * Accept only media assets created by this application and owned by the current
 * session user. Never persist arbitrary third-party URLs or expiring storage URLs
 * as message/comment attachment references.
 */
export async function validateOwnedMediaAttachments(input: {
  requestUrl: string
  ownerId: string
  raw: unknown
  maxItems?: number
}): Promise<{ ok: true; attachments: DurableAttachment[] } | { ok: false; error: string }> {
  const { requestUrl, ownerId, raw } = input
  const maxItems = input.maxItems ?? 4
  if (!Array.isArray(raw)) return { ok: false, error: "INVALID_ATTACHMENTS" }
  if (raw.length > maxItems) return { ok: false, error: "TOO_MANY_ATTACHMENTS" }
  if (raw.length === 0) return { ok: true, attachments: [] }

  const requestOrigin = new URL(requestUrl).origin
  const parsed: DurableAttachment[] = []
  for (let index = 0; index < raw.length; index++) {
    const item = raw[index]
    if (!item || typeof item !== "object") return { ok: false, error: "INVALID_ATTACHMENTS" }
    const o = item as Record<string, unknown>
    const rawUrl = typeof o.url === "string" ? o.url.trim() : ""
    if (!rawUrl || rawUrl.length > 2048 || rawUrl.startsWith("blob:") || rawUrl.startsWith("data:")) {
      return { ok: false, error: "INVALID_ATTACHMENTS" }
    }
    let url: URL
    try {
      url = new URL(rawUrl, requestOrigin)
    } catch {
      return { ok: false, error: "INVALID_ATTACHMENTS" }
    }
    if (url.origin !== requestOrigin || url.protocol !== "https:" && url.protocol !== "http:" || url.username || url.password || url.search || url.hash) {
      return { ok: false, error: "INVALID_ATTACHMENTS" }
    }
    const match = /^\/api\/media\/(media_[a-z0-9]+_[a-z0-9]+)\/content$/i.exec(url.pathname)
    if (!match) return { ok: false, error: "INVALID_ATTACHMENTS" }
    const typeRaw = String(o.type || "file").toLowerCase()
    if (typeRaw !== "image" && typeRaw !== "video" && typeRaw !== "file") return { ok: false, error: "INVALID_ATTACHMENTS" }
    const sizeBytes = o.sizeBytes == null ? undefined : Number(o.sizeBytes)
    if (sizeBytes !== undefined && (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 50 * 1024 * 1024)) {
      return { ok: false, error: "INVALID_ATTACHMENTS" }
    }
    parsed.push({
      id: match[1], type: typeRaw, url: url.pathname,
      fileName: sanitizeAttachmentFileName(o.fileName),
      mimeType: o.mimeType == null ? undefined : String(o.mimeType).slice(0, 120),
      sizeBytes,
    })
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "MEDIA_AUTHORIZATION_UNAVAILABLE" }
  const base = env.supabaseUrl.replace(/\/$/, "")
  const headers = {
    "Content-Type": "application/json",
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
  }
  const reconciled = new Map<string, DurableAttachment>()
  const uniqueIds = [...new Set(parsed.map((attachment) => attachment.id))]
  for (const mediaId of uniqueIds) {
    try {
      const response = await fetch(`${base}/rest/v1/rpc/gh_media_authorize_viewer`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_media_id: mediaId, p_viewer_id: ownerId }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) return { ok: false, error: "MEDIA_AUTHORIZATION_UNAVAILABLE" }
      const asset = await response.json() as { ok?: boolean; mediaId?: string; ownerId?: string }
      if (asset?.ok !== true || asset.mediaId !== mediaId || asset.ownerId !== ownerId) {
        return { ok: false, error: "ATTACHMENT_NOT_OWNED" }
      }
      // Re-read the stored record for authoritative MIME type, kind and size.
      const rowResponse = await fetch(
        `${base}/rest/v1/gh_media_assets?id=eq.${encodeURIComponent(mediaId)}&select=owner_id,mime_type,byte_size,media_kind,status,deleted_at&limit=1`,
        { method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(8_000) },
      )
      if (!rowResponse.ok) return { ok: false, error: "MEDIA_AUTHORIZATION_UNAVAILABLE" }
      const rows = await rowResponse.json() as unknown
      const row = Array.isArray(rows) ? rows[0] : undefined
      if (!row || typeof row !== "object") return { ok: false, error: "ATTACHMENT_NOT_OWNED" }
      const declared = parsed.find((attachment) => attachment.id === mediaId)!
      const result = reconcileAttachmentWithAsset(declared, row as Record<string, unknown>, ownerId)
      if (!result.ok) return result
      reconciled.set(mediaId, result.attachment)
    } catch {
      return { ok: false, error: "MEDIA_AUTHORIZATION_UNAVAILABLE" }
    }
  }
  return {
    ok: true,
    attachments: parsed.map((attachment) => {
      const server = reconciled.get(attachment.id)!
      return { ...attachment, type: server.type, mimeType: server.mimeType, sizeBytes: server.sizeBytes }
    }),
  }
}
