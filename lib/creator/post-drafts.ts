/**
 * Phase 7 — local post drafts (device only until published).
 * Never invents published content or balances.
 */

import type { PostDraft } from "@/lib/ghc-types"
import { IdentityService } from "@/lib/identity/identity-service"

const KEY_PREFIX = "ghc.post-drafts.v2:"
const LEGACY_KEY = "ghc.post-drafts.v1"
const MAX = 20

function storageKey(): string {
  const ownerId = String(IdentityService.getCurrentUserId() || "current-user").trim() || "current-user"
  return `${KEY_PREFIX}${encodeURIComponent(ownerId)}`
}

function readRaw(): PostDraft[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey())
    // The old v1 key had no owner identity. Never import it into an arbitrary
    // signed-in account: that could expose one person's drafts to another.
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((d) => d && typeof d === "object" && typeof (d as PostDraft).id === "string")
      .map((d) => {
        const x = d as PostDraft
        return {
          id: String(x.id),
          content: typeof x.content === "string" ? x.content : "",
          images: Array.isArray(x.images) ? x.images.filter((u) => typeof u === "string" && u.length <= 4000 && !u.startsWith("blob:") && !u.startsWith("data:")).slice(0, 10) : [],
          video: typeof x.video === "string" && x.video.length <= 4000 && !x.video.startsWith("blob:") ? x.video : null,
          pdf: typeof x.pdf === "string" && x.pdf.length <= 4000 && !x.pdf.startsWith("blob:") ? x.pdf : null,
          pdfName: typeof x.pdfName === "string" ? x.pdfName.slice(0, 200) : null,
          visibility: ["public", "followers", "mutuals", "private"].includes(String(x.visibility)) ? x.visibility : "public",
          communityId: typeof x.communityId === "string" ? x.communityId.slice(0, 120) : null,
          communityName: typeof x.communityName === "string" ? x.communityName.slice(0, 120) : null,
          publishRequestId: typeof x.publishRequestId === "string" && /^post_[a-z0-9_-]{6,80}$/i.test(x.publishRequestId) ? x.publishRequestId : null,
          publishRequestSignature: typeof x.publishRequestSignature === "string" ? x.publishRequestSignature.slice(0, 4000) : null,
          hashtags: Array.isArray(x.hashtags) ? x.hashtags.map(String).slice(0, 30) : [],
          mentions: Array.isArray(x.mentions) ? x.mentions.map(String).slice(0, 30) : [],
          createdAt: Number(x.createdAt) || Date.now(),
          lastEditedAt: Number(x.lastEditedAt) || Date.now(),
        }
      })
      .slice(0, MAX)
  } catch {
    return []
  }
}

function writeRaw(list: PostDraft[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* */
  }
}

/** True only to explain that unowned legacy drafts were intentionally not imported. */
export function hasUnscopedLegacyPostDrafts(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0
  } catch { return false }
}

export function listPostDrafts(): PostDraft[] {
  return readRaw().sort((a, b) => (b.lastEditedAt || 0) - (a.lastEditedAt || 0))
}

export function upsertPostDraft(input: {
  id?: string
  content: string
  images?: string[]
  video?: string | null
  pdf?: string | null
  pdfName?: string | null
  visibility?: "public" | "followers" | "mutuals" | "private"
  communityId?: string | null
  communityName?: string | null
  publishRequestId?: string | null
  publishRequestSignature?: string | null
  hashtags?: string[]
  mentions?: string[]
}): PostDraft {
  const list = readRaw()
  const id = (input.id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim()
  const now = Date.now()
  const existing = list.find((d) => d.id === id)
  const next: PostDraft = {
    id,
    content: String(input.content || "").slice(0, 5000),
    images: (input.images || existing?.images || []).filter((url) => typeof url === "string" && url.length <= 4000 && !url.startsWith("blob:") && !url.startsWith("data:")).slice(0, 10),
    video: input.video !== undefined ? (typeof input.video === "string" && input.video.length <= 4000 && !/^(?:blob:|data:)/i.test(input.video) ? input.video : null) : existing?.video ?? null,
    pdf: input.pdf !== undefined ? (typeof input.pdf === "string" && input.pdf.length <= 4000 && !/^(?:blob:|data:)/i.test(input.pdf) ? input.pdf : null) : existing?.pdf ?? null,
    pdfName: input.pdfName !== undefined ? input.pdfName : existing?.pdfName ?? null,
    visibility: input.visibility || existing?.visibility || "public",
    communityId: input.communityId !== undefined ? input.communityId : existing?.communityId ?? null,
    communityName: input.communityName !== undefined ? input.communityName : existing?.communityName ?? null,
    publishRequestId: input.publishRequestId !== undefined ? input.publishRequestId : existing?.publishRequestId ?? null,
    publishRequestSignature: input.publishRequestSignature !== undefined ? input.publishRequestSignature : existing?.publishRequestSignature ?? null,
    hashtags: (input.hashtags || existing?.hashtags || []).map(String).slice(0, 30),
    mentions: (input.mentions || existing?.mentions || []).map(String).slice(0, 30),
    createdAt: existing?.createdAt || now,
    lastEditedAt: now,
  }
  const others = list.filter((d) => d.id !== id)
  writeRaw([next, ...others])
  try {
    window.dispatchEvent(new CustomEvent("ghc:post-drafts-changed", { detail: { id } }))
  } catch {
    /* */
  }
  return next
}

export function removePostDraft(id: string): void {
  writeRaw(readRaw().filter((d) => d.id !== id))
  try {
    window.dispatchEvent(new CustomEvent("ghc:post-drafts-changed", { detail: { id, removed: true } }))
  } catch {
    /* */
  }
}

export function getPostDraft(id: string): PostDraft | null {
  return readRaw().find((d) => d.id === id) || null
}
