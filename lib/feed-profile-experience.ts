import { isOwnAuthor, CURRENT_USER_ID } from "@/lib/ownership"
/**
 * GH Connect — Feed + Profile experience layer (items 1–20 each).
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

const COLLECTIONS_KEY = "ghc_save_collections_v1"

export function loadCollections(): SavedCollection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    if (!raw) {
      const seeded = DEFAULT_SAVE_COLLECTIONS.map((name, i) => ({
        id: `col_${i}`,
        name,
        postIds: [] as string[],
        createdAt: Date.now(),
      }))
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(seeded))
      return seeded
    }
    return JSON.parse(raw)
  } catch {
    const seeded = DEFAULT_SAVE_COLLECTIONS.map((name, i) => ({
      id: `col_${i}`,
      name,
      postIds: [] as string[],
      createdAt: Date.now(),
    }))
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(seeded))
    } catch {
      /* */
    }
    return seeded
  }
}

export function savePostToCollection(collectionId: string, postId: string): SavedCollection[] {
  const cols = loadCollections()
  const next = cols.map((c) =>
    c.id === collectionId
      ? { ...c, postIds: Array.from(new Set([postId, ...c.postIds])) }
      : c
  )
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next))
  } catch {
    /* */
  }
  return next
}

export function removePostFromCollections(postId: string): SavedCollection[] {
  const next = loadCollections().map((c) => ({
    ...c,
    postIds: c.postIds.filter((id) => id !== postId),
  }))
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next))
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
