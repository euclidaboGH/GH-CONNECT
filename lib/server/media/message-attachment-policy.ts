import { maxMediaBytesForMime } from "./path-policy.mjs"

export type DurableAttachment = {
  id: string
  type: "image" | "video" | "file"
  url: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
}

/** Message attachments are limited to types the upload pipeline sniffs and accepts. */
const MESSAGE_ATTACHMENT_MIME_KIND: Readonly<Record<string, DurableAttachment["type"]>> = Object.freeze({
  "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image", "image/avif": "image",
  "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
  "application/pdf": "file",
  "audio/mpeg": "file", "audio/mp4": "file", "audio/aac": "file", "audio/ogg": "file",
  "audio/wav": "file", "audio/webm": "file", "audio/flac": "file",
})

/** Strip path separators, control characters and bidi overrides from display file names. */
export function sanitizeAttachmentFileName(value: unknown): string | undefined {
  if (value == null) return undefined
  const cleaned = String(value)
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\\/]/g, "_")
    .trim()
    .slice(0, 180)
  return cleaned || undefined
}

/**
 * Server-authoritative attachment facts. Client-declared MIME type, kind and size are
 * never trusted: they are replaced by the stored, byte-sniffed asset record.
 */
export function reconcileAttachmentWithAsset(
  declared: DurableAttachment,
  asset: { mime_type?: unknown; byte_size?: unknown; media_kind?: unknown; owner_id?: unknown; status?: unknown; deleted_at?: unknown },
  ownerId: string,
): { ok: true; attachment: DurableAttachment } | { ok: false; error: string } {
  if (asset.owner_id !== ownerId) return { ok: false, error: "ATTACHMENT_NOT_OWNED" }
  if (asset.status !== "ready" || asset.deleted_at != null) return { ok: false, error: "ATTACHMENT_NOT_OWNED" }
  const mime = typeof asset.mime_type === "string" ? asset.mime_type.toLowerCase() : ""
  const kind = MESSAGE_ATTACHMENT_MIME_KIND[mime]
  if (!kind) return { ok: false, error: "ATTACHMENT_TYPE_NOT_ALLOWED" }
  if (asset.media_kind !== undefined && asset.media_kind !== null && asset.media_kind !== kind) {
    return { ok: false, error: "ATTACHMENT_TYPE_NOT_ALLOWED" }
  }
  const size = Number(asset.byte_size)
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxMediaBytesForMime(mime)) {
    return { ok: false, error: "ATTACHMENT_TOO_LARGE" }
  }
  return { ok: true, attachment: { ...declared, type: kind, mimeType: mime, sizeBytes: size } }
}

