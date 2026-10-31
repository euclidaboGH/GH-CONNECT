/**
 * Repository interfaces — domain services depend on these, not on React state.
 * Local = session/sdk cache; HTTP = backend-authoritative with local optimistic cache.
 */

import type {
  Post,
  Message,
  Conversation,
  Profile,
  StoryItem,
  MatchEntry,
  FriendRequest,
} from "../ghc-types"
import type { DomainReport } from "./types"

export interface PostRepository {
  list(): Post[]
  get(id: string): Post | undefined
  save(post: Post): void
  update(id: string, patch: Partial<Post>): void
  hydrate?: () => Promise<void>
}

export interface MessageRepository {
  listByConversation(conversationId: string): Message[]
  append(conversationId: string, message: Message): void
  update(conversationId: string, messageId: string, patch: Partial<Message>): void
  hydrateConversation?: (conversationId: string) => Promise<Message[]>
}

export interface ConversationRepository {
  list(): Conversation[]
  get(id: string): Conversation | undefined
  save(conversation: Conversation): void
  update(id: string, patch: Partial<Conversation>): void
  hydrate?: () => Promise<void>
}

export interface ReportRepository {
  create(report: DomainReport): void
  list(): DomainReport[]
}

export interface ProfileRepository {
  get(): Profile
  update(patch: Partial<Profile>): void
  hydrate?: () => Promise<Profile | null>
}

export interface SocialGraphSnapshotData {
  following: string[]
  followers: string[]
  friends: string[]
  blockedUsers: string[]
  mutedUsers: string[]
  restrictedUsers: string[]
  matches: MatchEntry[]
  friendRequests: FriendRequest[]
  outgoingFriendRequestIds?: string[]
  incomingFriendRequestIds?: string[]
}

export interface SocialGraphRepository {
  getSnapshot(): SocialGraphSnapshotData
  applyPatch(patch: Partial<SocialGraphSnapshotData>): void
  hydrate?: () => Promise<SocialGraphSnapshotData | null>
  recordEdge?: (input: {
    type:
      | "follow"
      | "unfollow"
      | "friend_request"
      | "friend_accept"
      | "friend_remove"
      | "match"
      | "unmatch"
      | "block"
      | "unblock"
      | "mute"
      | "unmute"
      | "restrict"
      | "unrestrict"
    targetUserId: string
    meta?: Record<string, unknown>
  }) => void
}

export interface StoryRepository {
  list(): StoryItem[]
  save(story: StoryItem): void
  update(id: string, patch: Partial<StoryItem>): void
  remove?(id: string): void
  hydrate?: () => Promise<void>
}

export function createLocalPostRepository(deps: {
  getPosts: () => Post[]
  setPosts: (updater: (posts: Post[]) => Post[]) => void
}): PostRepository {
  return {
    list: () => deps.getPosts(),
    get: (id) => deps.getPosts().find((p) => p.id === id),
    save: (post) => deps.setPosts((posts) => [post, ...posts.filter((p) => p.id !== post.id)]),
    update: (id, patch) =>
      deps.setPosts((posts) => posts.map((p) => (p.id === id ? { ...p, ...patch } : p))),
  }
}

export function createLocalMessageRepository(deps: {
  getConversations: () => Conversation[]
  setConversations: (updater: (c: Conversation[]) => Conversation[]) => void
}): MessageRepository {
  return {
    listByConversation: (conversationId) => {
      const c = deps.getConversations().find((x) => x.id === conversationId)
      return c?.messages || []
    },
    append: (conversationId, message) => {
      deps.setConversations((convs) =>
        convs.map((c) => {
          if (c.id !== conversationId) return c
          const messages = [...(c.messages || []), message]
          return {
            ...c,
            messages,
            lastMessage: message.text,
            lastMessageTime: message.createdAt || Date.now(),
          }
        })
      )
    },
    update: (conversationId, messageId, patch) => {
      deps.setConversations((convs) =>
        convs.map((c) => {
          if (c.id !== conversationId) return c
          return {
            ...c,
            messages: (c.messages || []).map((m) =>
              m.id === messageId ? { ...m, ...patch } : m
            ),
          }
        })
      )
    },
  }
}

export function createLocalConversationRepository(deps: {
  getConversations: () => Conversation[]
  setConversations: (updater: (c: Conversation[]) => Conversation[]) => void
}): ConversationRepository {
  return {
    list: () => deps.getConversations(),
    get: (id) => deps.getConversations().find((c) => c.id === id),
    save: (conversation) =>
      deps.setConversations((convs) => {
        const exists = convs.some((c) => c.id === conversation.id)
        if (exists) {
          return convs.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
        }
        return [conversation, ...convs]
      }),
    update: (id, patch) =>
      deps.setConversations((convs) =>
        convs.map((c) => (c.id === id ? { ...c, ...patch } : c))
      ),
  }
}

export function createLocalStoryRepository(deps: {
  getStories: () => StoryItem[]
  setStories: (updater: (s: StoryItem[]) => StoryItem[]) => void
}): StoryRepository {
  return {
    list: () => deps.getStories(),
    save: (story) =>
      deps.setStories((list) => [story, ...list.filter((s) => s.id !== story.id)]),
    update: (id, patch) =>
      deps.setStories((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    remove: (id) => deps.setStories((list) => list.filter((s) => s.id !== id)),
  }
}

export function createLocalSocialGraphRepository(deps: {
  getSnapshot: () => SocialGraphSnapshotData
  applyPatch: (patch: Partial<SocialGraphSnapshotData>) => void
}): SocialGraphRepository {
  return {
    getSnapshot: () => deps.getSnapshot(),
    applyPatch: (patch) => deps.applyPatch(patch),
  }
}

export function createLocalReportRepository(deps?: {
  onCreate?: (report: DomainReport) => void
}): ReportRepository {
  const KEY = "ghc_domain_reports"
  const read = (): DomainReport[] => {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }
  return {
    create: (report) => {
      try {
        const all = read()
        all.push(report)
        localStorage.setItem(KEY, JSON.stringify(all.slice(-200)))
      } catch {
        /* */
      }
      deps?.onCreate?.(report)
    },
    list: read,
  }
}

export function createLocalProfileRepository(deps: {
  getProfile: () => Profile
  setProfile: (patch: Partial<Profile>) => void
}): ProfileRepository {
  return {
    get: () => deps.getProfile(),
    update: (patch) => deps.setProfile(patch),
  }
}
