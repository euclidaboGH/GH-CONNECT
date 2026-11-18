import { isOwnAuthor, CURRENT_USER_ID } from "@/lib/ownership"
/**
 * GreenHaven — Feed + Profile experience layer (items 1–20 each).
 * Pure helpers + constants; UI wires these for consistent product behavior.
 */

import type { Post, Profile } from "./ghc-types"

/** Meaningful reactions (Feed #5) — beyond vanity likes */
export const MEANINGFUL_REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "support", emoji: "💪", label: "Support" },
  { type: "inspire", emoji: "✨", label: "Inspire" },
  { type: "insight", emoji: "💡", label: "Insightful" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
  { type: "love", emoji: "❤️", label: "Love" },
] as const

export type MeaningfulReactionType = (typeof MEANINGFUL_REACTIONS)[number]["type"]

/** Default save collections (Feed #12) */
export const DEFAULT_SAVE_COLLECTIONS = [
  "Work",
  "Ideas",
  "Later",
  "Inspiration",
  "Jobs & Growth",
] as const

export interface SavedCollection {
  id: string
  name: string
  postIds: string[]
  createdAt: number
}

const COLLECTIONS_KEY_PREFIX = "ghc_save_collections_v2"

/** Keep device-local collection names and post references isolated by signed-in account. */
function collectionsStorageKey(scopeId?: string): string {
  const owner = String(scopeId || "guest").trim() || "guest"
  // Avoid putting raw account identifiers in browser storage keys while keeping
  // the namespace deterministic across renders and browser sessions.
  let first = 0x811c9dc5
  let second = 0x811c9dc5
  for (let index = 0; index < owner.length; index += 1) {
    const code = owner.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ (code + index), 0x01000193)
  }
  const scopeHash = `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`
  return `${COLLECTIONS_KEY_PREFIX}:${scopeHash}`
}

export function loadCollections(scopeId?: string): SavedCollection[] {
  const storageKey = collectionsStorageKey(scopeId)
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      const seeded = DEFAULT_SAVE_COLLECTIONS.map((name, i) => ({
        id: `col_${i}`,
        name,
        postIds: [] as string[],
        createdAt: Date.now(),
      }))
      localStorage.setItem(storageKey, JSON.stringify(seeded))
      return seeded
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error("Invalid saved collections")
    return parsed.filter((item): item is SavedCollection => {
      if (!item || typeof item !== "object") return false
      const candidate = item as Partial<SavedCollection>
      return typeof candidate.id === "string" && typeof candidate.name === "string" &&
        Array.isArray(candidate.postIds) && typeof candidate.createdAt === "number"
    }).map((item) => ({
      id: item.id.slice(0, 120),
      name: item.name.trim().slice(0, 40),
      postIds: Array.from(new Set(item.postIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200))).slice(0, 5000),
      createdAt: Number.isFinite(item.createdAt) && item.createdAt > 0 ? item.createdAt : Date.now(),
    })).filter((item) => item.id && item.name)
  } catch {
    const seeded = DEFAULT_SAVE_COLLECTIONS.map((name, i) => ({
      id: `col_${i}`,
      name,
      postIds: [] as string[],
      createdAt: Date.now(),
    }))
    try {
      localStorage.setItem(storageKey, JSON.stringify(seeded))
    } catch {
      /* */
    }
    return seeded
  }
}

export function savePostToCollection(collectionId: string, postId: string, scopeId?: string): SavedCollection[] {
  const cols = loadCollections(scopeId)
  const next = cols.map((c) =>
    c.id === collectionId
      ? { ...c, postIds: Array.from(new Set([postId, ...c.postIds])) }
      : c
  )
  try {
    localStorage.setItem(collectionsStorageKey(scopeId), JSON.stringify(next))
  } catch {
    /* */
  }
  return next
}


export function createCollection(name: string, scopeId?: string): SavedCollection {
  const trimmed = String(name || "").trim().slice(0, 40)
  const cols = loadCollections(scopeId)
  if (!trimmed) {
    return cols[0] || { id: "col_0", name: "Later", postIds: [], createdAt: Date.now() }
  }
  const existing = cols.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing
  const col: SavedCollection = {
    id: `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    postIds: [],
    createdAt: Date.now(),
  }
  const next = [col, ...cols]
  try {
    localStorage.setItem(collectionsStorageKey(scopeId), JSON.stringify(next))
  } catch {
    /* */
  }
  return col
}

export function removePostFromCollections(postId: string, scopeId?: string): SavedCollection[] {
  const next = loadCollections(scopeId).map((c) => ({
    ...c,
    postIds: c.postIds.filter((id) => id !== postId),
  }))
  try {
    localStorage.setItem(collectionsStorageKey(scopeId), JSON.stringify(next))
  } catch {
    /* */
  }
  return next
}

/** Light post insights for own posts — private analytics surface */
export function computePostInsights(post: Post) {
  const eng = post.engagement
  const likes = eng?.likes ?? post.likes ?? 0
  const comments = eng?.comments ?? post.comments?.length ?? 0
  const shares = eng?.shares ?? (post as any).shareCount ?? post.shares ?? 0
  const saves = eng?.saves ?? (post as any).saveCount ?? 0
  const views = eng?.views ?? post.viewCount ?? 0
  // Reach: prefer measured views; else estimate from engagement
  const reach = Math.max(
    views,
    likes * 3 + comments * 5 + shares * 8 + saves * 4,
    likes + comments,
  )
  const reactions = likes + comments * 2 + shares * 3 + saves
  return {
    likes,
    comments,
    shares,
    saves,
    views,
    reach,
    reactions,
    engagementRate:
      reach > 0 ? Math.min(100, Math.round((reactions / reach) * 100)) : 0,
    audience: post.visibility || post.visibleTo || "public",
  }
}

/** Mute duration options (Feed #11) */
export type MuteDuration = "30d" | "forever"

export function muteUntil(duration: MuteDuration): number | null {
  if (duration === "forever") return null
  return Date.now() + 30 * 24 * 60 * 60 * 1000
}

/** Profile bio prompts (Profile #15) */
export const BIO_PROMPTS = [
  "What I’m building…",
  "What I’m learning…",
  "How I can help…",
  "A community I care about…",
] as const

/** Profile completeness remaining actions helper */
export function nextProfileActions(profile: Profile): string[] {
  const actions: string[] = []
  if (!profile.photos?.[0] || String(profile.photos[0]).includes("placeholder"))
    actions.push("Add a clear profile photo")
  if (!profile.coverPhoto || String(profile.coverPhoto).includes("placeholder"))
    actions.push("Add a cover photo")
  if (!profile.bio || profile.bio.trim().length < 20) actions.push("Write a short bio")
  if (!(profile as any).profession) actions.push("Add work or profession")
  if (!(profile as any).education) actions.push("Add education")
  if (!profile.interests || profile.interests.length < 3) actions.push("Pick at least 3 interests")
  return actions
}

/** Own posts only for profile timeline (Profile #8) */
export function filterOwnPosts(posts: Post[], userId = CURRENT_USER_ID, profile?: Pick<Profile, "displayName" | "id"> | null): Post[] {
  return posts
    .filter((p) => (isOwnAuthor(p.authorId, p.authorName, profile) || p.authorId === userId) && !(p as any).deletedAt && !(p as any).isArchived)
    .sort((a, b) => {
      const ap = (a as any).isPinned ? 1 : 0
      const bp = (b as any).isPinned ? 1 : 0
      if (bp !== ap) return bp - ap
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
}

/** Media grid from own posts (Profile #13) */
export function extractMediaFromPosts(posts: Post[]): { postId: string; url: string; type: "image" | "video" }[] {
  const out: { postId: string; url: string; type: "image" | "video" }[] = []
  for (const p of posts) {
    for (const url of p.images || []) {
      if (url) out.push({ postId: p.id, url, type: "image" })
    }
    if ((p as any).video) out.push({ postId: p.id, url: (p as any).video, type: "video" })
  }
  return out
}

/** Inspiration ranking boost keywords (Feed #15) */
const INSPIRE_WORDS = [
  "learn",
  "build",
  "grateful",
  "community",
  "faith",
  "growth",
  "help",
  "inspire",
  "opportunity",
  "mentor",
]

export function inspirationBoost(content: string): number {
  const lower = (content || "").toLowerCase()
  return INSPIRE_WORDS.reduce((n, w) => n + (lower.includes(w) ? 8 : 0), 0)
}

/** Accessibility: ensure alt text fallback (Feed #18) */
export function mediaAltText(post: Post, index = 0): string {
  if ((post as any).altText) return (post as any).altText
  const snippet = (post.content || "").trim().slice(0, 80)
  return snippet
    ? `Photo from ${post.authorName}: ${snippet}`
    : `Photo by ${post.authorName || "user"}`
}
