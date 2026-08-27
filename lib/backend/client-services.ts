/**
 * Client-side backend implementations (Pi SDK + local engines).
 * These are the default adapters until a remote API is wired.
 */

import { generateId, seedCandidates, seedPosts } from "@/lib/ghc-data"
import { detectSpamContent, sanitizePostText } from "@/lib/post-comment-system-complete"
import type {
  BackendResult,
  FeedService,
  MatchingService,
  MessagingService,
  ModerationService,
  ProfileService,
  ReportTarget,
} from "./types"
import type { Candidate, Conversation, MatchEntry, Message, Post, Profile, Settings } from "@/lib/ghc-types"

function ok<T>(data: T): BackendResult<T> {
  return { ok: true, data }
}

function fail<T = never>(error: string, code?: string): BackendResult<T> {
  return { ok: false, error, code }
}

const PROHIBITED = [
  /\b(child\s*porn|csam|underage\s*sex)\b/i,
  /\b(kill\s*yourself|kys)\b/i,
]

export function createModerationService(): ModerationService {
  return {
    async report(target: ReportTarget, reporterId: string) {
      if (!reporterId || !target.targetId) return fail("Invalid report", "invalid")
      // Persist via caller’s state / SDK; return structured result for UI
      return ok({ reportId: `report-${generateId()}` })
    },
    async blockUser(userId, blockerId) {
      if (!userId || !blockerId || userId === blockerId) return fail("Invalid block", "invalid")
      return ok(undefined)
    },
    async muteUser(userId, muterId) {
      if (!userId || !muterId) return fail("Invalid mute", "invalid")
      return ok(undefined)
    },
    async checkContent(text: string) {
      const flags: string[] = []
      const value = typeof text === "string" ? text : ""
      if (detectSpamContent(value)) flags.push("spam")
      for (const rule of PROHIBITED) {
        if (rule.test(value)) flags.push("prohibited")
      }
      if (value.length > 5000) flags.push("too_long")
      return ok({ allowed: !flags.includes("prohibited"), flags })
    },
  }
}

export function createMatchingService(getCandidates?: () => Candidate[]): MatchingService {
  return {
    async getCandidates(_viewer, limit = 20) {
      const list = typeof getCandidates === "function" ? getCandidates() : seedCandidates()
      return ok(list.slice(0, limit))
    },
    async swipe(viewerId, targetId, action) {
      if (!viewerId || !targetId) return fail("Invalid swipe", "invalid")
      if (action === "like" && Math.random() > 0.7) {
        const match: MatchEntry = {
          id: `match-${generateId()}`,
          userId: targetId,
          userName: "Match",
          userPhoto: "/placeholder-user.jpg",
          matchedAt: Date.now(),
          online: true,
        }
        return ok({ matched: true, match })
      }
      return ok({ matched: false })
    },
    async getMatches(_userId) {
      return ok([])
    },
  }
}

export function createMessagingService(): MessagingService {
  return {
    async listConversations(_userId) {
      return ok([] as Conversation[])
    },
    async sendMessage(conversationId, senderId, text) {
      const clean = sanitizePostText(String(text || "")).slice(0, 5000)
      if (!clean.trim()) return fail("Empty message", "empty")
      if (!conversationId || !senderId) return fail("Invalid message", "invalid")
      const message: Message = {
        id: generateId(),
        senderId,
        text: clean,
        createdAt: Date.now(),
        status: "sent",
      } as Message
      return ok(message)
    },
    async markRead(_conversationId, _userId) {
      return ok(undefined)
    },
  }
}

export function createProfileService(): ProfileService {
  return {
    async getProfile(_userId) {
      return fail("Use local context for profile", "local_only")
    },
    async updateProfile(_userId, updates) {
      return ok(updates as Profile)
    },
    async getSettings(_userId) {
      return fail("Use local context for settings", "local_only")
    },
    async updateSettings(_userId, updates) {
      return ok(updates as Settings)
    },
  }
}

export function createFeedService(getPosts?: () => Post[]): FeedService {
  return {
    async listPosts(_viewerId, _mode) {
      const posts = typeof getPosts === "function" ? getPosts() : seedPosts()
      return ok(posts)
    },
    async createPost(authorId, content, media) {
      const check = await createModerationService().checkContent(content)
      if (check.ok && !check.data.allowed) {
        return fail("Content not allowed", "prohibited")
      }
      const post: Post = {
        id: generateId(),
        authorId,
        authorName: "You",
        authorPhoto: "/placeholder-user.jpg",
        content: sanitizePostText(content),
        images: media?.images || [],
        video: media?.video ?? null,
        pdf: null,
        pdfName: null,
        likes: 0,
        comments: [],
        createdAt: Date.now(),
      }
      return ok(post)
    },
    async likePost(_postId, _userId) {
      return ok(undefined)
    },
  }
}
