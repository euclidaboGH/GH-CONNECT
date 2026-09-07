/**
 * CommunityDomain — belonging, content, organization (not private messaging).
 *
 * Separation:
 *   COMMUNITY     → identity, members, roles, posts/discussions, events, rules
 *   COMMUNITY CHAT→ realtime member conversation (Messaging domain, kind community)
 *   MESSAGES      → private 1:1 or private group (Messaging domain, private/group)
 *
 * One messaging architecture; different conversation kinds + permissions.
 * Does not invent a second chat engine.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import type { Conversation } from "../ghc-types"
import {
  createAnnouncement,
  createPoll,
  createEvent,
  type Announcement,
  type Poll,
  type ScheduledEvent,
} from "../community-features-engine"

/** Canonical community roles (ordered by power) */
export type CommunityRole = "owner" | "admin" | "moderator" | "member"

export const COMMUNITY_ROLES: CommunityRole[] = [
  "owner",
  "admin",
  "moderator",
  "member",
]

export type CommunityPrivacy = "public" | "private" | "invite-only"

export type CommunityAction =
  | "view"
  | "post"
  | "comment"
  | "moderate"
  | "remove_member"
  | "invite"
  | "manage_roles"
  | "settings"
  | "announce"
  | "events"
  | "chat"

const ROLE_RANK: Record<CommunityRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
}

/** Default permission matrix */
const ROLE_PERMISSIONS: Record<CommunityRole, Set<CommunityAction>> = {
  owner: new Set([
    "view",
    "post",
    "comment",
    "moderate",
    "remove_member",
    "invite",
    "manage_roles",
    "settings",
    "announce",
    "events",
    "chat",
  ]),
  admin: new Set([
    "view",
    "post",
    "comment",
    "moderate",
    "remove_member",
    "invite",
    "manage_roles",
    "settings",
    "announce",
    "events",
    "chat",
  ]),
  moderator: new Set([
    "view",
    "post",
    "comment",
    "moderate",
    "remove_member",
    "invite",
    "announce",
    "events",
    "chat",
  ]),
  member: new Set(["view", "post", "comment", "chat"]),
}

export function normalizeRole(role: string | undefined | null): CommunityRole {
  if (role === "owner" || role === "admin" || role === "moderator" || role === "member") {
    return role
  }
  // Legacy: group "admin" without owner distinction
  if (role === "Admin") return "admin"
  return "member"
}

export function canCommunityAction(
  role: CommunityRole | string | undefined,
  action: CommunityAction
): boolean {
  const r = normalizeRole(role as string)
  return ROLE_PERMISSIONS[r]?.has(action) ?? false
}

/** @deprecated alias — prefer canCommunityAction */
export const canPerform = canCommunityAction


export function isCommunityConversation(c: Conversation | undefined | null): boolean {
  if (!c) return false
  if (c.conversationType !== "group") return false
  const kind = (c as any).kind || (c as any).communityId ? "community" : "group"
  // Explicit community marker or historical groups treated as communities in product UI
  return kind === "community" || Boolean((c as any).groupName) || c.conversationType === "group"
}

/** Private group chat vs community org space */
export function conversationChannelKind(
  c: Conversation
): "private_dm" | "private_group" | "community_chat" {
  if (c.conversationType === "private") return "private_dm"
  if ((c as any).kind === "community" || (c as any).communityId) return "community_chat"
  return "private_group"
}

export function createCommunityDomain(deps: {
  currentUserId?: string
  getConversations: () => Conversation[]
  getBlockedUsers?: () => string[]
}) {
  const actorId = deps.currentUserId || "current-user"

  function find(communityId: string) {
    return deps.getConversations().find((c) => c.id === communityId)
  }

  function roleOf(community: Conversation, userId: string): CommunityRole {
    if (community.createdBy === userId) return "owner"
    const roles = (community as any).groupRoles || (community as any).roles || {}
    return normalizeRole(roles[userId])
  }

  function assertAction(
    communityId: string,
    action: CommunityAction
  ): { ok: true; community: Conversation; role: CommunityRole } | { ok: false; error: string } {
    const community = find(communityId)
    if (!community) return { ok: false, error: "Community not found" }
    const role = roleOf(community, actorId)
    if (!canCommunityAction(role, action)) {
      return { ok: false, error: `Not allowed to ${action.replace("_", " ")}` }
    }
    return { ok: true, community, role }
  }

  return {
    can: canCommunityAction,
    roleOf,
    isCommunityConversation,
    conversationChannelKind,

    listCommunities(): Conversation[] {
      return deps.getConversations().filter((c) => isCommunityConversation(c))
    },

    listPrivateGroups(): Conversation[] {
      return deps.getConversations().filter(
        (c) => c.conversationType === "group" && conversationChannelKind(c) === "private_group"
      )
    },

    async createCommunity(input: {
      name: string
      description?: string
      privacy?: CommunityPrivacy
      category?: string
      coverImage?: string
      welcomeMessage?: string
      rules?: string | string[]
      invitedMembers?: string[]
    }): Promise<MutationResult<{ community: Conversation }>> {
      return runMutation({
        name: "community.create",
        actorId,
        input,
        validate: (i) => (!(i.name || "").trim() ? "Name required" : null),
        mutate: (i) => {
          const id = `comm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
          const now = Date.now()
          const members = Array.from(new Set([actorId, ...(i.invitedMembers || [])]))
          const welcomeBody =
            (i.welcomeMessage || "").trim() ||
            `Welcome to ${i.name.trim()}! Introduce yourself and read the rules.`
          const rulesArr = Array.isArray(i.rules)
            ? i.rules
            : typeof i.rules === "string" && i.rules.trim()
              ? i.rules.split("\n").map((r) => r.trim()).filter(Boolean)
              : []
          const boardPosts = [
            {
              id: `bpost_welcome_${id}`,
              communityId: id,
              authorId: actorId,
              authorName: "You",
              body: welcomeBody,
              kind: "text" as const,
              createdAt: now,
              likes: 0,
              comments: 0,
              pinned: true,
            },
            ...(rulesArr.length
              ? [
                  {
                    id: `bpost_rules_${id}`,
                    communityId: id,
                    authorId: actorId,
                    authorName: "You",
                    body: `Community rules:\n${rulesArr.map((r, idx) => `${idx + 1}. ${r}`).join("\n")}`,
                    kind: "resource" as const,
                    createdAt: now + 1,
                    likes: 0,
                    comments: 0,
                    pinned: true,
                  },
                ]
              : []),
          ]
          const community: Conversation = {
            id,
            participantId: "",
            participantName: i.name.trim(),
            participantPhoto: i.coverImage || "/placeholder.svg?height=80&width=80",
            messages: [],
            lastMessage: "Community created · Board is ready",
            lastMessageTime: now,
            unread: false,
            online: false,
            conversationType: "group",
            groupName: i.name.trim(),
            groupPhoto: i.coverImage || undefined,
            photo: i.coverImage || undefined,
            members,
            groupRoles: { [actorId]: "owner" },
            createdBy: actorId,
            createdAt: now,
            privacy: i.privacy || "public",
            description: i.description,
            category: i.category,
            welcomeMessage: i.welcomeMessage,
            rules: i.rules,
            invitedMembers: i.invitedMembers || [],
            pendingJoinRequests: [],
            boardPosts,
            // Canonical markers — community org + linked chat channel is this conversation
            kind: "community",
            communityId: id,
          } as Conversation
          return { community }
        },
        eventType: "CONVERSATION_CREATED",
        eventPayload: (d) => ({
          conversationId: d.community.id,
          kind: "community",
        }),
      })
    },

    async inviteMember(
      communityId: string,
      userId: string
    ): Promise<MutationResult<{ communityId: string; userId: string; invitedMembers: string[] }>> {
      return runMutation({
        name: "community.invite",
        actorId,
        input: { communityId, userId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "invite")
          if (!gate.ok) return gate.error
          if (deps.getBlockedUsers?.()?.includes(i.userId)) return "Cannot invite blocked user"
          const community = find(i.communityId)
          if (!community) return "Community not found"
          if ((community.members || []).includes(i.userId)) return "Already a member"
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const invitedMembers = Array.from(
            new Set([...((community as any).invitedMembers || []), i.userId])
          )
          // Persist on conversation row when setter exists
          try {
            const next = { ...(community as any), invitedMembers }
            deps.setConversation?.(i.communityId, next)
          } catch { /* optional */ }
          return { communityId: i.communityId, userId: i.userId, invitedMembers }
        },
        eventType: "COMMUNITY_INVITED",
        eventPayload: (d) => ({ communityId: d.communityId, userId: d.userId, actorId }),
      })
    },

    /** Invitee accepts a pending invitation — re-checks invitedMembers at mutation time */
    async acceptInvitation(
      communityId: string
    ): Promise<MutationResult<{ communityId: string; members: string[] }>> {
      return runMutation({
        name: "community.acceptInvitation",
        actorId,
        input: { communityId },
        authorize: (i) => {
          const community = find(i.communityId)
          if (!community) return "Community not found"
          if ((community.members || []).includes(actorId)) return "Already a member"
          const invited = (community as any).invitedMembers || []
          if (!invited.includes(actorId)) return "No active invitation"
          if (deps.getBlockedUsers?.()?.includes(community.createdBy || "")) {
            return "Cannot join — relationship blocked"
          }
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const members = Array.from(new Set([...(community.members || []), actorId]))
          const invitedMembers = ((community as any).invitedMembers || []).filter(
            (id: string) => id !== actorId
          )
          try {
            deps.setConversation?.(i.communityId, {
              ...(community as any),
              members,
              invitedMembers,
              groupRoles: {
                ...((community as any).groupRoles || {}),
                [actorId]: "member",
              },
            })
          } catch { /* */ }
          return { communityId: i.communityId, members }
        },
        eventType: "COMMUNITY_JOINED",
        eventPayload: (d) => ({ communityId: d.communityId, userId: actorId, via: "invitation" }),
      })
    },

    /** Invitee declines — removes from invitedMembers only */
    async declineInvitation(
      communityId: string
    ): Promise<MutationResult<{ communityId: string }>> {
      return runMutation({
        name: "community.declineInvitation",
        actorId,
        input: { communityId },
        authorize: (i) => {
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const invited = (community as any).invitedMembers || []
          if (!invited.includes(actorId) && !(community.members || []).includes(actorId)) {
            return "No active invitation"
          }
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const invitedMembers = ((community as any).invitedMembers || []).filter(
            (id: string) => id !== actorId
          )
          try {
            deps.setConversation?.(i.communityId, {
              ...(community as any),
              invitedMembers,
            })
          } catch { /* */ }
          return { communityId: i.communityId }
        },
        eventType: "COMMUNITY_INVITE_DECLINED",
        eventPayload: (d) => ({ communityId: d.communityId, userId: actorId }),
      })
    },

    async removeMember(
      communityId: string,
      userId: string
    ): Promise<MutationResult<{ communityId: string; userId: string }>> {
      return runMutation({
        name: "community.removeMember",
        actorId,
        input: { communityId, userId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "remove_member")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)!
          const targetRole = roleOf(community, i.userId)
          const actorRole = roleOf(community, actorId)
          if (targetRole === "owner") return "Cannot remove the owner"
          if (ROLE_RANK[targetRole] >= ROLE_RANK[actorRole] && actorRole !== "owner") {
            return "Cannot remove a member of equal or higher role"
          }
          return null
        },
        mutate: (i) => ({ communityId: i.communityId, userId: i.userId }),
      })
    },

    async setRole(
      communityId: string,
      userId: string,
      role: CommunityRole
    ): Promise<MutationResult<{ communityId: string; userId: string; role: CommunityRole }>> {
      return runMutation({
        name: "community.setRole",
        actorId,
        input: { communityId, userId, role },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "manage_roles")
          if (!gate.ok) return gate.error
          if (i.role === "owner") return "Transfer ownership is a separate flow"
          const community = find(i.communityId)!
          if (roleOf(community, i.userId) === "owner") return "Cannot change owner role this way"
          return null
        },
        mutate: (i) => ({
          communityId: i.communityId,
          userId: i.userId,
          role: normalizeRole(i.role),
        }),
      })
    },

    async createAnnouncement(
      communityId: string,
      input: {
        title: string
        content: string
        type?: "info" | "important" | "celebration" | "maintenance"
      }
    ): Promise<MutationResult<{ announcement: Announcement }>> {
      return runMutation({
        name: "community.announce",
        actorId,
        input: { communityId, ...input },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "announce")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => ({
          announcement: createAnnouncement(
            i.communityId,
            actorId,
            i.title,
            i.content,
            i.type || "info"
          ),
        }),
      })
    },

    async createPoll(
      communityId: string,
      input: { question: string; options: string[]; allowMultiple?: boolean; durationMinutes?: number }
    ): Promise<MutationResult<{ poll: Poll }>> {
      return runMutation({
        name: "community.poll",
        actorId,
        input: { communityId, ...input },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "post")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => ({
          poll: createPoll(
            i.communityId,
            actorId,
            i.question,
            i.options,
            i.durationMinutes ?? 60,
            Boolean(i.allowMultiple)
          ),
        }),
      })
    },

    async createEvent(
      communityId: string,
      input: {
        title: string
        description: string
        startTime: number
        endTime: number
        location?: string
        category?: "meeting" | "social" | "workshop" | "discussion" | "celebration"
      }
    ): Promise<MutationResult<{ event: ScheduledEvent }>> {
      return runMutation({
        name: "community.event",
        actorId,
        input: { communityId, ...input },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "events")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => ({
          event: createEvent(
            i.communityId,
            actorId,
            i.title,
            i.description,
            i.startTime,
            i.endTime,
            i.category,
            i.location
          ),
        }),
      })
    },

    /**
     * Resolve community chat conversation id (same underlying Messaging pipeline).
     * Today community org + chat share the group Conversation row; marker is kind=community.
     */
    getChatConversationId(communityId: string): string | null {
      const c = find(communityId)
      if (!c) return null
      if (!canCommunityAction(roleOf(c, actorId), "chat")) return null
      return c.id
    },

    /** Public join — adds actor to members with role member. */
    async joinCommunity(
      communityId: string
    ): Promise<MutationResult<{ communityId: string; members: string[] }>> {
      return runMutation({
        name: "community.join",
        actorId,
        input: { communityId },
        authorize: (i) => {
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const privacy = ((community as any).privacy || "public") as CommunityPrivacy
          if (privacy === "private") return "This community is private — you need an invite"
          if (privacy === "invite-only") return "Request to join — admin approval required"
          const members = community.members || []
          if (members.includes(actorId)) return "Already a member"
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const members = Array.from(new Set([...(community.members || []), actorId]))
          return { communityId: i.communityId, members }
        },
        eventType: "COMMUNITY_JOINED",
        eventPayload: (d) => ({ communityId: d.communityId, userId: actorId }),
      })
    },

    /** Invite-only: queue a join request for admins (does not add membership yet). */
    async requestJoin(
      communityId: string,
      message?: string
    ): Promise<MutationResult<{ communityId: string; pendingRequests: string[] }>> {
      return runMutation({
        name: "community.requestJoin",
        actorId,
        input: { communityId, message },
        authorize: (i) => {
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const members = community.members || []
          if (members.includes(actorId)) return "Already a member"
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const pending = Array.from(
            new Set([...((community as any).pendingJoinRequests || []), actorId])
          )
          return { communityId: i.communityId, pendingRequests: pending }
        },
      })
    },

    async leaveCommunity(
      communityId: string
    ): Promise<MutationResult<{ communityId: string; members: string[] }>> {
      return runMutation({
        name: "community.leave",
        actorId,
        input: { communityId },
        authorize: (i) => {
          const community = find(i.communityId)
          if (!community) return "Community not found"
          if (community.createdBy === actorId || roleOf(community, actorId) === "owner") {
            return "Owners cannot leave — transfer ownership first"
          }
          if (!(community.members || []).includes(actorId)) return "Not a member"
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const members = (community.members || []).filter((id) => id !== actorId)
          return { communityId: i.communityId, members }
        },
      })
    },

    async approveJoinRequest(
      communityId: string,
      userId: string
    ): Promise<MutationResult<{ communityId: string; userId: string; members: string[]; pendingJoinRequests: string[] }>> {
      return runMutation({
        name: "community.approveJoin",
        actorId,
        input: { communityId, userId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "invite")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          if ((community.members || []).includes(i.userId)) return "Already a member"
          const pending = (community as any).pendingJoinRequests || []
          if (!pending.includes(i.userId)) return "No pending join request"
          if (deps.getBlockedUsers?.()?.includes(i.userId)) return "Cannot approve blocked user"
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const members = Array.from(new Set([...(community.members || []), i.userId]))
          const pendingJoinRequests = ((community as any).pendingJoinRequests || []).filter(
            (id: string) => id !== i.userId
          )
          return { communityId: i.communityId, userId: i.userId, members, pendingJoinRequests }
        },
        eventType: "COMMUNITY_JOIN_APPROVED",
        eventPayload: (d) => ({ communityId: d.communityId, userId: d.userId, actorId }),
      })
    },

    async declineJoinRequest(
      communityId: string,
      userId: string
    ): Promise<MutationResult<{ communityId: string; userId: string; pendingJoinRequests: string[] }>> {
      return runMutation({
        name: "community.declineJoin",
        actorId,
        input: { communityId, userId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "invite")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const pending = (community as any).pendingJoinRequests || []
          if (!pending.includes(i.userId)) return "No pending join request"
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const pendingJoinRequests = ((community as any).pendingJoinRequests || []).filter(
            (id: string) => id !== i.userId
          )
          return { communityId: i.communityId, userId: i.userId, pendingJoinRequests }
        },
        eventType: "COMMUNITY_JOIN_DECLINED",
        eventPayload: (d) => ({ communityId: d.communityId, userId: d.userId, actorId }),
      })
    },

    /** Board post stored on the community conversation (local-first). */
    async createBoardPost(
      communityId: string,
      input: { body: string; kind?: "text" | "question" | "resource" }
    ): Promise<
      MutationResult<{
        post: {
          id: string
          communityId: string
          authorId: string
          authorName: string
          body: string
          kind: string
          createdAt: number
          likes: number
          comments: number
        }
      }>
    > {
      return runMutation({
        name: "community.boardPost",
        actorId,
        input: { communityId, ...input },
        authorize: (i) => {
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const members = community.members || []
          if (!members.includes(actorId) && community.createdBy !== actorId) {
            return "Join this community to post on the board"
          }
          if (!(i.body || "").trim()) return "Write something before posting"
          if ((i.body || "").trim().length > 2000) return "Post is too long (max 2000 characters)"
          return null
        },
        mutate: (i) => {
          const body = i.body.trim()
          const post = {
            id: `bpost_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            communityId: i.communityId,
            authorId: actorId,
            authorName: "You",
            body,
            kind: i.kind || "text",
            createdAt: Date.now(),
            likes: 0,
            comments: 0,
          }
          return { post }
        },
      })
    },

    /**
     * Reply to a board post (same local-first authority as createBoardPost).
     * Stores replies[] on the post; increments comments count.
     */
    async replyToBoardPost(
      communityId: string,
      postId: string,
      body: string
    ): Promise<
      MutationResult<{
        postId: string
        reply: {
          id: string
          postId: string
          authorId: string
          authorName: string
          body: string
          createdAt: number
        }
        comments: number
      }>
    > {
      return runMutation({
        name: "community.boardReply",
        actorId,
        input: { communityId, postId, body },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "comment")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const posts = ((community as any).boardPosts || []) as any[]
          if (!posts.some((p) => p.id === i.postId)) return "Discussion not found"
          if (!(i.body || "").trim()) return "Write a reply first"
          if ((i.body || "").trim().length > 1000) return "Reply is too long (max 1000 characters)"
          return null
        },
        mutate: (i) => {
          const reply = {
            id: `breply_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            postId: i.postId,
            authorId: actorId,
            authorName: "You",
            body: i.body.trim(),
            createdAt: Date.now(),
          }
          const community = find(i.communityId)!
          const posts = ((community as any).boardPosts || []) as any[]
          const post = posts.find((p) => p.id === i.postId)
          const replies = [...(post?.replies || []), reply]
          const comments = replies.length
          return { postId: i.postId, reply, comments }
        },
      })
    },

    /**
     * Toggle like reaction on a board post (idempotent per actor).
     * Only reaction type supported: like.
     */
    async reactToBoardPost(
      communityId: string,
      postId: string,
      reaction: "like" = "like"
    ): Promise<
      MutationResult<{ postId: string; likes: number; likedByMe: boolean; likedBy: string[] }>
    > {
      return runMutation({
        name: "community.boardReact",
        actorId,
        input: { communityId, postId, reaction },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "comment")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const posts = ((community as any).boardPosts || []) as any[]
          if (!posts.some((p) => p.id === i.postId)) return "Discussion not found"
          if (i.reaction !== "like") return "Unsupported reaction"
          return null
        },
        mutate: (i) => {
          const community = find(i.communityId)!
          const posts = ((community as any).boardPosts || []) as any[]
          const post = posts.find((p) => p.id === i.postId)
          const likedBy = new Set<string>((post?.likedBy || []) as string[])
          let likedByMe = likedBy.has(actorId)
          if (likedByMe) {
            likedBy.delete(actorId)
            likedByMe = false
          } else {
            likedBy.add(actorId)
            likedByMe = true
          }
          const arr = Array.from(likedBy)
          return {
            postId: i.postId,
            likes: arr.length,
            likedByMe,
            likedBy: arr,
          }
        },
      })
    },

    
    async pinBoardPost(
      communityId: string,
      postId: string
    ): Promise<MutationResult<{ postId: string; pinned: boolean }>> {
      return runMutation({
        name: "community.boardPin",
        actorId,
        input: { communityId, postId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "moderate")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const posts = ((community as any).boardPosts || []) as any[]
          if (!posts.some((p) => p.id === i.postId)) return "Discussion not found"
          if (posts.find((p) => p.id === i.postId)?.hidden) return "Cannot pin a hidden post"
          return null
        },
        mutate: (i) => ({ postId: i.postId, pinned: true }),
      })
    },

    async unpinBoardPost(
      communityId: string,
      postId: string
    ): Promise<MutationResult<{ postId: string; pinned: boolean }>> {
      return runMutation({
        name: "community.boardUnpin",
        actorId,
        input: { communityId, postId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "moderate")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const posts = ((community as any).boardPosts || []) as any[]
          if (!posts.some((p) => p.id === i.postId)) return "Discussion not found"
          return null
        },
        mutate: (i) => ({ postId: i.postId, pinned: false }),
      })
    },

    /** Soft-hide a board post (reversible moderation). */
    async hideBoardPost(
      communityId: string,
      postId: string
    ): Promise<MutationResult<{ postId: string; hidden: boolean }>> {
      return runMutation({
        name: "community.boardHide",
        actorId,
        input: { communityId, postId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "moderate")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          const posts = ((community as any).boardPosts || []) as any[]
          if (!posts.some((p) => p.id === i.postId)) return "Discussion not found"
          return null
        },
        mutate: (i) => ({ postId: i.postId, hidden: true }),
      })
    },

    async unhideBoardPost(
      communityId: string,
      postId: string
    ): Promise<MutationResult<{ postId: string; hidden: boolean }>> {
      return runMutation({
        name: "community.boardUnhide",
        actorId,
        input: { communityId, postId },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "moderate")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          return null
        },
        mutate: (i) => ({ postId: i.postId, hidden: false }),
      })
    },

    
    async transitionLifecycle(
      communityId: string,
      next: "draft" | "discoverable" | "active" | "quiet" | "archived"
    ): Promise<MutationResult<{ communityId: string; lifecycle: string }>> {
      return runMutation({
        name: "community.lifecycle",
        actorId,
        input: { communityId, next },
        authorize: (i) => {
          const gate = assertAction(i.communityId, "settings")
          if (!gate.ok) return gate.error
          const community = find(i.communityId)
          if (!community) return "Community not found"
          return null
        },
        mutate: (i) => ({ communityId: i.communityId, lifecycle: i.next }),
      })
    },

    async reportCommunityContent(
      communityId: string,
      input: {
        targetType: "community" | "post" | "member"
        targetId: string
        reason: string
        note?: string
      }
    ): Promise<MutationResult<{ reportId: string }>> {
      return runMutation({
        name: "community.report",
        actorId,
        input: { communityId, ...input },
        authorize: (i) => {
          const community = find(i.communityId)
          if (!community) return "Community not found"
          if (!(i.targetId || "").trim()) return "Invalid report target"
          if (!(i.reason || "").trim()) return "Select a reason"
          return null
        },
        mutate: (i) => ({
          reportId: `crep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        }),
      })
    },

    listBoardPosts(communityId: string): Array<{
      id: string
      communityId: string
      authorId: string
      authorName: string
      body: string
      kind: string
      createdAt: number
      likes: number
      comments: number
    }> {
      const c = find(communityId)
      if (!c) return []
      const posts = ((c as any).boardPosts || []) as Array<{
        id: string
        communityId: string
        authorId: string
        authorName: string
        body: string
        kind: string
        createdAt: number
        likes: number
        comments: number
      }>
      return [...posts]
        .filter((p) => !(p as any).hidden)
        .sort((a, b) => b.createdAt - a.createdAt)
    },
  }
}

export type CommunityDomain = ReturnType<typeof createCommunityDomain>
