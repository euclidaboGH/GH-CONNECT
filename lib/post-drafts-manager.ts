// Post Drafts and Scheduled Posts Manager
// Manages post drafts, scheduling, and queuing without affecting existing Post interface

import type { PostDraft } from "@/lib/ghc-types"
import { generateId } from "./ghc-data"

const DRAFTS_STORAGE_KEY = "gh_connect_post_drafts"
const SCHEDULED_POSTS_KEY = "gh_connect_scheduled_posts"

interface ScheduledPost {
  id: string
  content: string
  images: string[]
  video: string | null
  hashtags: string[]
  mentions: string[]
  scheduledFor: number // timestamp
  createdAt: number
  status: "pending" | "published" | "failed"
}

export const postDraftsManager = {
  // Create a new draft
  createDraft: (
    content: string,
    images: string[] = [],
    video: string | null = null,
    hashtags: string[] = [],
    mentions: string[] = []
  ): PostDraft => {
    const draft: PostDraft = {
      id: generateId(),
      content,
      images,
      video,
      hashtags,
      mentions,
      createdAt: Date.now(),
      lastEditedAt: Date.now(),
    }

    const drafts = postDraftsManager.getAllDrafts()
    drafts.push(draft)
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts))

    return draft
  },

  // Get all drafts
  getAllDrafts: (): PostDraft[] => {
    try {
      const stored = localStorage.getItem(DRAFTS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  },

  // Get draft by ID
  getDraft: (draftId: string): PostDraft | null => {
    const drafts = postDraftsManager.getAllDrafts()
    return drafts.find((d) => d.id === draftId) || null
  },

  // Update draft
  updateDraft: (draftId: string, updates: Partial<PostDraft>): PostDraft | null => {
    const drafts = postDraftsManager.getAllDrafts()
    const index = drafts.findIndex((d) => d.id === draftId)

    if (index === -1) return null

    drafts[index] = {
      ...drafts[index],
      ...updates,
      lastEditedAt: Date.now(),
    }

    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts))
    return drafts[index]
  },

  // Delete draft
  deleteDraft: (draftId: string): boolean => {
    const drafts = postDraftsManager.getAllDrafts()
    const filtered = drafts.filter((d) => d.id !== draftId)

    if (filtered.length === drafts.length) return false

    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(filtered))
    return true
  },

  // Clear all drafts
  clearAllDrafts: (): void => {
    localStorage.removeItem(DRAFTS_STORAGE_KEY)
  },

  // Schedule a post
  schedulePost: (
    content: string,
    images: string[],
    video: string | null,
    hashtags: string[],
    mentions: string[],
    scheduledFor: number
  ): ScheduledPost => {
    const post: ScheduledPost = {
      id: generateId(),
      content,
      images,
      video,
      hashtags,
      mentions,
      scheduledFor,
      createdAt: Date.now(),
      status: "pending",
    }

    const scheduled = postDraftsManager.getAllScheduledPosts()
    scheduled.push(post)
    localStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(scheduled))

    return post
  },

  // Get all scheduled posts
  getAllScheduledPosts: (): ScheduledPost[] => {
    try {
      const stored = localStorage.getItem(SCHEDULED_POSTS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  },

  // Get pending scheduled posts (not yet published)
  getPendingScheduledPosts: (): ScheduledPost[] => {
    const scheduled = postDraftsManager.getAllScheduledPosts()
    return scheduled.filter((p) => p.status === "pending" && p.scheduledFor <= Date.now())
  },

  // Mark scheduled post as published
  markAsPublished: (postId: string): ScheduledPost | null => {
    const scheduled = postDraftsManager.getAllScheduledPosts()
    const post = scheduled.find((p) => p.id === postId)

    if (!post) return null

    post.status = "published"
    localStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(scheduled))
    return post
  },

  // Mark scheduled post as failed
  markAsFailed: (postId: string): ScheduledPost | null => {
    const scheduled = postDraftsManager.getAllScheduledPosts()
    const post = scheduled.find((p) => p.id === postId)

    if (!post) return null

    post.status = "failed"
    localStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(scheduled))
    return post
  },

  // Reschedule a post
  reschedulePost: (postId: string, newScheduledTime: number): ScheduledPost | null => {
    const scheduled = postDraftsManager.getAllScheduledPosts()
    const post = scheduled.find((p) => p.id === postId)

    if (!post) return null

    post.scheduledFor = newScheduledTime
    localStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(scheduled))
    return post
  },

  // Cancel scheduled post
  cancelScheduledPost: (postId: string): boolean => {
    const scheduled = postDraftsManager.getAllScheduledPosts()
    const filtered = scheduled.filter((p) => p.id !== postId)

    if (filtered.length === scheduled.length) return false

    localStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(filtered))
    return true
  },

  // Get scheduled posts by date range
  getScheduledPostsByDateRange: (startDate: number, endDate: number): ScheduledPost[] => {
    const scheduled = postDraftsManager.getAllScheduledPosts()
    return scheduled.filter((p) => p.scheduledFor >= startDate && p.scheduledFor <= endDate)
  },

  // Check if there are posts to publish (background service worker task)
  checkAndPublishScheduledPosts: async (publishCallback: (post: ScheduledPost) => Promise<boolean>) => {
    const pending = postDraftsManager.getPendingScheduledPosts()

    for (const post of pending) {
      try {
        const success = await publishCallback(post)
        if (success) {
          postDraftsManager.markAsPublished(post.id)
        } else {
          postDraftsManager.markAsFailed(post.id)
        }
      } catch (error) {
        console.error("Error publishing scheduled post:", error)
        postDraftsManager.markAsFailed(post.id)
      }
    }
  },

  // Save draft as scheduled post
  convertDraftToScheduled: (draftId: string, scheduledFor: number): ScheduledPost | null => {
    const draft = postDraftsManager.getDraft(draftId)
    if (!draft) return null

    const scheduled = postDraftsManager.schedulePost(
      draft.content,
      draft.images,
      draft.video,
      draft.hashtags,
      draft.mentions,
      scheduledFor
    )

    postDraftsManager.deleteDraft(draftId)
    return scheduled
  },

  // Get draft count
  getDraftCount: (): number => {
    return postDraftsManager.getAllDrafts().length
  },

  // Get scheduled post count
  getScheduledPostCount: (): number => {
    return postDraftsManager.getAllScheduledPosts().length
  },

  // Export all drafts and scheduled posts
  exportData: (): { drafts: PostDraft[]; scheduled: ScheduledPost[] } => {
    return {
      drafts: postDraftsManager.getAllDrafts(),
      scheduled: postDraftsManager.getAllScheduledPosts(),
    }
  },

  // Import drafts and scheduled posts
  importData: (data: { drafts: PostDraft[]; scheduled: ScheduledPost[] }): void => {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(data.drafts || []))
    localStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(data.scheduled || []))
  },
}

// Auto-sync scheduled posts every minute (in a real app, this would be a service worker)
export function startScheduledPostsAutoSync(
  publishCallback: (post: ScheduledPost) => Promise<boolean>
) {
  const interval = setInterval(() => {
    postDraftsManager.checkAndPublishScheduledPosts(publishCallback)
  }, 60000) // Check every minute

  return () => clearInterval(interval)
}
