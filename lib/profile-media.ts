/**
 * Profile avatar / cover preparation — compress + prefer durable media URL.
 * Falls back to compressed data URL when storage is unavailable.
 */

import { compressForAvatar, compressForCover } from "@/lib/media/compress-image"
import { uploadDurableMedia } from "@/lib/media/upload-client"

export async function prepareProfilePhoto(
  file: File,
  kind: "photo" | "cover"
): Promise<{ ok: true; url: string; durable: boolean } | { ok: false; error: string }> {
  try {
    if (!file || file.size <= 0) return { ok: false, error: "Empty file" }
    // Compress first so local/server persistence stays manageable
    const dataUrl =
      kind === "cover" ? await compressForCover(file) : await compressForAvatar(file)
    if (!dataUrl || !String(dataUrl).startsWith("data:image/")) {
      return { ok: false, error: "Could not process this image" }
    }

    // Prefer durable URL when media API is configured
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const named = new File(
        [blob],
        kind === "cover" ? "cover.jpg" : "avatar.jpg",
        { type: blob.type || "image/jpeg" }
      )
      const up = await uploadDurableMedia(named, {
        fileName: named.name,
      })
      if (up.ok && up.url && (up.url.startsWith("http") || up.url.startsWith("/"))) {
        return { ok: true, url: up.url, durable: true }
      }
    } catch {
      /* storage optional */
    }

    return { ok: true, url: dataUrl, durable: false }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not prepare image",
    }
  }
}
