/**
 * StoryDomain — canonical owner of story lifecycle.
 *
 * Create → Publish → View → React → Reply → Expire → Archive → Highlight
 *
 * Single story list lives in session (GHCContext); this domain owns mutations
 * and visibility rules. Reply opens Messaging (no separate story-chat system).
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import {
  canViewStory,
  buildPermissionContext,
  type PermissionContext,
} from "../permission-engine"
import type { StoryItem, StoryAudience, StoryStatus } from "../ghc-types"
import { sanitizeStory } from "../ghc-data"

/** Default story TTL: 24 hours */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000

function genId() {
  return `story_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createStoryDomain(deps: {
  currentUserId?: string
  getStories: () => StoryItem[]
  getBlockedUsers: () => string[]
  getMutedUsers?: () => string[]
  matchIds?: () => string[]
  friendIds?: () => string[]
  followingIds?: () => string[]
  storyVisibility?: () => PermissionContext["storyVisibility"]
}) {
  const actorId = deps.currentUserId || "current-user"

  function permCtx(targetStoryVisibility?: PermissionContext["targetStoryVisibility"]) {
    return buildPermissionContext({
      currentUserId: actorId,
      blockedUsers: deps.getBlockedUsers(),
      matchIds: deps.matchIds?.() || [],
      friendIds: deps.friendIds?.() || [],
      followingIds: deps.followingIds?.() || [],
      storyVisibility: deps.storyVisibility?.() || "everyone",
      targetStoryVisibility,
    })
  }

  function isExpired(s: StoryItem, now = Date.now()) {
    if (s.status === "expired") return true
    if (s.status === "highlight") return false
    if (typeof s.expiresAt === "number" && s.expiresAt <= now) return true
    if (!s.expiresAt && s.createdAt && now - s.createdAt > STORY_TTL_MS) return true
    return false
  }

  return {
    find(storyId: string) {
      return deps.getStories().find((s) => s.id === storyId)
    },

    isExpired,

    /** Visible tray: not blocked/muted, not expired/archived (unless highlight) */
    visibleStories(stories?: StoryItem[]): StoryItem[] {
      const list = stories ?? deps.getStories()
      const blocked = new Set([
        ...deps.getBlockedUsers(),
        ...(deps.getMutedUsers?.() || []),
      ])
      const now = Date.now()
      return list.filter((s) => {
        if (s.ownerId && blocked.has(s.ownerId)) return false
        if (s.status === "archived" || s.status === "draft") return false
        if (s.status === "highlight") return true
        if (isExpired(s, now)) return false
        if (s.ownerId && s.ownerId !== actorId) {
          if (!canViewStory(permCtx(), s.ownerId)) return false
        }
        return true
      })
    },

    async createDraft(input: {
      text?: string
      media?: StoryItem["media"]
      name?: string
      photo?: string
      audience?: StoryAudience
    }): Promise<MutationResult<StoryItem>> {
      return runMutation({
        name: "story.createDraft",
        actorId,
        input,
        mutate: (i) => {
          const raw: StoryItem = {
            id: genId(),
            ownerId: actorId,
            name: i.name || "You",
            photo: i.photo,
            text: (i.text || "").trim(),
            media: i.media ?? null,
            createdAt: Date.now(),
            status: "draft",
            audience: i.audience || "everyone",
          }
          const clean = sanitizeStory(raw) || raw
          return { ...clean, status: "draft", audience: i.audience || "everyone" }
        },
        eventType: "STORY_CREATED",
        eventPayload: (s) => ({ storyId: s.id, status: "draft" }),
      })
    },

    async publish(
      story: StoryItem,
      options?: { audience?: StoryAudience; ttlMs?: number }
    ): Promise<MutationResult<StoryItem>> {
      return runMutation({
        name: "story.publish",
        actorId,
        input: { story, options },
        validate: (i) => {
          const t = (i.story.text || "").trim()
          const hasMedia = Boolean(i.story.media?.url)
          if (!t && !hasMedia) return "Story cannot be empty"
          return null
        },
        mutate: (i) => {
          const now = Date.now()
          const ttl = i.options?.ttlMs ?? STORY_TTL_MS
          const raw: StoryItem = {
            ...i.story,
            id: i.story.id || genId(),
            ownerId: i.story.ownerId || actorId,
            createdAt: i.story.createdAt || now,
            status: "published",
            audience: i.options?.audience || i.story.audience || "everyone",
            expiresAt: now + ttl,
          }
          const clean = sanitizeStory(raw)
          if (!clean) throw new Error("Story failed safety checks")
          return {
            ...clean,
            status: "published" as StoryStatus,
            audience: raw.audience,
            expiresAt: raw.expiresAt,
            ownerId: raw.ownerId,
          }
        },
        eventType: "STORY_CREATED",
        eventPayload: (s) => ({ storyId: s.id, status: "published" }),
      })
    },

    async recordView(storyId: string): Promise<MutationResult<{ storyId: string; viewIds: string[] }>> {
      return runMutation({
        name: "story.view",
        actorId,
        input: { storyId },
        authorize: (i) => {
          const s = deps.getStories().find((x) => x.id === i.storyId)
          if (!s) return "Story not found"
          if (isExpired(s)) return "Story expired"
          if (s.ownerId && s.ownerId !== actorId && !canViewStory(permCtx(), s.ownerId)) {
            return "Not allowed to view this story"
          }
          return null
        },
        mutate: (i) => {
          const s = deps.getStories().find((x) => x.id === i.storyId)!
          const viewIds = Array.from(new Set([...(s.viewIds || []), actorId]))
          return { storyId: i.storyId, viewIds }
        },
      })
    },

    async react(
      storyId: string,
      emoji: string
    ): Promise<MutationResult<{ storyId: string; reactionCounts: Record<string, number> }>> {
      return runMutation({
        name: "story.react",
        actorId,
        input: { storyId, emoji },
        validate: (i) => (!(i.emoji || "").trim() ? "Missing reaction" : null),
        authorize: (i) => {
          const s = deps.getStories().find((x) => x.id === i.storyId)
          if (!s || isExpired(s)) return "Story unavailable"
          if (s.ownerId && deps.getBlockedUsers().includes(s.ownerId)) return "Unavailable"
          return null
        },
        mutate: (i) => {
          const s = deps.getStories().find((x) => x.id === i.storyId)!
          const counts = { ...(s.reactionCounts || {}) }
          const key = i.emoji.trim()
          counts[key] = (counts[key] || 0) + 1
          return { storyId: i.storyId, reactionCounts: counts }
        },
      })
    },

    async expire(storyId: string): Promise<MutationResult<{ storyId: string }>> {
      return runMutation({
        name: "story.expire",
        actorId,
        input: { storyId },
        authorize: (i) => {
          const s = deps.getStories().find((x) => x.id === i.storyId)
          if (!s) return "Story not found"
          if (s.ownerId && s.ownerId !== actorId) return "Not your story"
          return null
        },
        mutate: (i) => ({ storyId: i.storyId }),
        eventType: "STORY_EXPIRED",
        eventPayload: (d) => d,
      })
    },

    async archive(storyId: string): Promise<MutationResult<{ storyId: string; archivedAt: number }>> {
      return runMutation({
        name: "story.archive",
        actorId,
        input: { storyId },
        authorize: (i) => {
          const s = deps.getStories().find((x) => x.id === i.storyId)
          if (!s) return "Story not found"
          if (s.ownerId && s.ownerId !== actorId) return "Not your story"
          return null
        },
        mutate: (i) => ({ storyId: i.storyId, archivedAt: Date.now() }),
      })
    },

    async highlight(storyId: string): Promise<MutationResult<{ storyId: string; highlightedAt: number }>> {
      return runMutation({
        name: "story.highlight",
        actorId,
        input: { storyId },
        authorize: (i) => {
          const s = deps.getStories().find((x) => x.id === i.storyId)
          if (!s) return "Story not found"
          if (s.ownerId && s.ownerId !== actorId) return "Not your story"
          return null
        },
        mutate: (i) => ({ storyId: i.storyId, highlightedAt: Date.now() }),
      })
    },

    /**
     * Story reply intent — does not send a message itself.
     * Returns target user for Messaging domain to open/create a private conversation.
     */
    resolveReplyTarget(storyId: string): MutationResult<{
      storyId: string
      ownerId: string
      ownerName: string
      ownerPhoto?: string
    }> {
      const s = deps.getStories().find((x) => x.id === storyId)
      if (!s) return { ok: false, error: "Story not found", phase: "validate", requestId: "story_reply" }
      if (isExpired(s) && s.status !== "highlight") {
        return { ok: false, error: "Story expired", phase: "validate", requestId: "story_reply" }
      }
      const ownerId = s.ownerId || ""
      if (!ownerId || ownerId === actorId) {
        return { ok: false, error: "Cannot reply to this story", phase: "validate", requestId: "story_reply" }
      }
      if (deps.getBlockedUsers().includes(ownerId)) {
        return { ok: false, error: "Cannot message this user", phase: "permission", requestId: "story_reply" }
      }
      if (!canViewStory(permCtx(), ownerId)) {
        return { ok: false, error: "Story not available", phase: "permission", requestId: "story_reply" }
      }
      return {
        ok: true,
        data: {
          storyId,
          ownerId,
          ownerName: s.name || "User",
          ownerPhoto: s.photo,
        },
        requestId: "story_reply",
      }
    },
  }
}

export type StoryDomain = ReturnType<typeof createStoryDomain>
