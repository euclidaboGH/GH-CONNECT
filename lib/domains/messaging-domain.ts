/**
 * MessagingDomain — single canonical messaging system.
 *
 * Conversation types:
 *   DIRECT | PRIVATE_GROUP | COMMUNITY
 *
 * Message states:
 *   sending → sent → delivered → read | failed | deleted
 *
 * Consolidates pure helpers from unified-messaging-engine + message-state-manager.
 * Does NOT create a second messaging engine.
 *
 * Permissions: block, privacy (whoCanMessage), membership, community role chat.
 *
 * Monetization: optional tools in messaging-premium.ts only.
 * Basic sendMessage is never blocked by payment or GHC balance.
 */



import { runMutation, type MutationResult } from "./mutation-pipeline"
import { MESSAGING_FREE_GUARANTEE } from "./messaging-premium"
import { softDeleteMessage } from "../social-graph"
import type { DomainMessage } from "./types"
import type { MessageRepository } from "./repositories"
import type { Conversation, Message } from "../ghc-types"
import {
  handleMessageEdit,
  handleMessageDeletion,
  prepareMessageForSending,
  toggleConversationPin,
  toggleConversationArchive,
  toggleConversationMute,
  isValidMessage,
  searchMessages,
  handleMessageReaction,
} from "../unified-messaging-engine"
import {
  canMessageUser,
  buildPermissionContext,
  type PermissionContext,
} from "../permission-engine"
import { canCommunityAction, normalizeRole } from "./community-domain"

/** Canonical product conversation types */
export type MessagingConversationType = "DIRECT" | "PRIVATE_GROUP" | "COMMUNITY"

/** Legacy ConversationKind alias used by earlier domain API */
export type ConversationKind = "private" | "group" | "community"

export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "deleted"

export const MESSAGE_STATUSES: MessageStatus[] = [
  "sending",
  "sent",
  "delivered",
  "read",
  "failed",
  "deleted",
]

/** Valid status transitions (failed/deleted are terminal-ish) */
const STATUS_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  sending: ["sent", "failed", "deleted"],
  sent: ["delivered", "read", "failed", "deleted"],
  delivered: ["read", "failed", "deleted"],
  read: ["deleted"],
  failed: ["sending", "deleted"], // retry → sending
  deleted: [],
}

export function canTransitionMessageStatus(
  from: MessageStatus,
  to: MessageStatus
): boolean {
  if (from === to) return true
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function resolveMessageStatus(message: Message): MessageStatus {
  if (message.isDeleted || message.isDeletedForEveryone || message.status === "deleted") {
    return "deleted"
  }
  const s = message.status
  if (
    s === "sending" ||
    s === "sent" ||
    s === "delivered" ||
    s === "read" ||
    s === "failed" ||
    s === "deleted"
  ) {
    return s
  }
  return "sent"
}

export function createMessagingDomain(deps: {
  currentUserId?: string
  isBlocked: (userId: string) => boolean
  getConversationParticipant?: (conversationId: string) => string | null
  getConversation?: (conversationId: string) => Conversation | undefined
  repository?: MessageRepository
  upsertConversation?: (conversation: Conversation) => void
  patchConversation?: (conversationId: string, patch: Partial<Conversation>) => void
  /** Privacy / graph context for permission checks */
  getPermissionContext?: () => PermissionContext
  isMember?: (conversationId: string, userId: string) => boolean
}) {
  const actorId = deps.currentUserId || "current-user"

  function kindOf(c: Conversation | undefined): ConversationKind {
    if (!c) return "private"
    if (c.conversationType === "group") {
      const meta = (c as any).communityId || (c as any).kind
      if (meta === "community" || (c as any).communityId) return "community"
      return "group"
    }
    return "private"
  }

  function messagingTypeOf(c: Conversation | undefined): MessagingConversationType {
    const k = kindOf(c)
    if (k === "community") return "COMMUNITY"
    if (k === "group") return "PRIVATE_GROUP"
    return "DIRECT"
  }

  /**
   * Full pre-send gate: block, privacy, membership, community chat permission.
   * UI must not invent parallel rules — call this or sendMessage (which uses it).
   */
  function evaluateSendPermission(input: {
    conversationId: string
    recipientId?: string
  }): { allowed: true } | { allowed: false; reason: string } {
    const conv = deps.getConversation?.(input.conversationId)
    if (!conv) return { allowed: false, reason: "Conversation not found" }

    const type = messagingTypeOf(conv)

    if (type === "DIRECT") {
      const other =
        input.recipientId ||
        deps.getConversationParticipant?.(input.conversationId) ||
        conv.participantId ||
        null
      if (!other) return { allowed: false, reason: "Missing recipient" }
      if (deps.isBlocked(other)) return { allowed: false, reason: "You can't message this user" }

      const pctx =
        deps.getPermissionContext?.() ||
        buildPermissionContext({
          currentUserId: actorId,
          blockedUsers: [],
        })
      if (!canMessageUser({ ...pctx, blockedByMe: pctx.blockedByMe }, other)) {
        return { allowed: false, reason: "Messaging not allowed by privacy settings" }
      }
      return { allowed: true }
    }

    // PRIVATE_GROUP / COMMUNITY — membership required
    const members: string[] = (conv as any).members || []
    const isMember =
      deps.isMember?.(input.conversationId, actorId) ??
      (members.includes(actorId) ||
        conv.createdBy === actorId ||
        Boolean((conv as any).groupRoles?.[actorId]))

    if (!isMember && members.length > 0) {
      return { allowed: false, reason: "You are not a member of this conversation" }
    }

    if (type === "COMMUNITY") {
      const roles = (conv as any).groupRoles || {}
      const role = normalizeRole(
        roles[actorId] || (conv.createdBy === actorId ? "owner" : "member")
      )
      if (!canCommunityAction(role, "chat")) {
        return { allowed: false, reason: "Community chat not permitted for your role" }
      }
    }

    return { allowed: true }
  }

  return {
    conversationKind(conversationId: string): ConversationKind {
      return kindOf(deps.getConversation?.(conversationId))
    },

    conversationType(conversationId: string): MessagingConversationType {
      return messagingTypeOf(deps.getConversation?.(conversationId))
    },

    evaluateSendPermission,
    /** Constant: chat is free */
    freeMessagingGuarantee: MESSAGING_FREE_GUARANTEE as string,
    resolveMessageStatus,
    canTransitionMessageStatus,

    async sendMessage(input: {
      conversationId: string
      text: string
      recipientId?: string
      replyToId?: string
      /** Offline path starts as sending */
      offline?: boolean
    }): Promise<MutationResult<DomainMessage & { uiMessage?: Message }>> {
      return runMutation({
        name: "messaging.send",
        actorId,
        input,
        validate: (i) => {
          if (!i.conversationId) return "Missing conversation"
          if (!(i.text || "").trim()) return "Message cannot be empty"
          if (i.text.length > 4000) return "Message is too long"
          if (!isValidMessage(i.text) && i.text.trim().length === 0) return "Message cannot be empty"
          return null
        },
        authorize: (i) => {
          const gate = evaluateSendPermission({
            conversationId: i.conversationId,
            recipientId: i.recipientId,
          })
          return gate.allowed ? null : gate.reason
        },
        mutate: (i) => {
          const initialStatus: MessageStatus = i.offline ? "sending" : "sent"
          const prepared =
            prepareMessageForSending(i.text.trim(), actorId, i.conversationId) ||
            ({
              id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
              senderId: actorId,
              text: i.text.trim(),
              createdAt: Date.now(),
              status: initialStatus,
            } as Message)

          const uiMessage: Message = {
            ...prepared,
            status: initialStatus,
            replyTo: i.replyToId || prepared.replyTo,
          }

          const msg: DomainMessage & { uiMessage?: Message } = {
            id: uiMessage.id,
            conversationId: i.conversationId,
            senderId: actorId,
            text: uiMessage.text,
            replyToId: i.replyToId,
            createdAt: uiMessage.createdAt || Date.now(),
            status: initialStatus,
            uiMessage,
          }

          if (deps.repository) {
            deps.repository.append(i.conversationId, uiMessage)
          }
          return msg
        },
        eventType: "MESSAGE_CREATED",
        eventPayload: (m) => ({
          conversationId: m.conversationId,
          messageId: m.id,
          status: m.status,
        }),
      })
    },

    /** Advance delivery state (sent → delivered → read) or mark failed / retry */
    async setMessageStatus(
      conversationId: string,
      messageId: string,
      next: MessageStatus,
      meta?: { failureReason?: string }
    ): Promise<MutationResult<{ message: Message }>> {
      return runMutation({
        name: "messaging.setStatus",
        actorId,
        input: { conversationId, messageId, next, meta },
        authorize: (i) => {
          const conv = deps.getConversation?.(i.conversationId)
          const message = conv?.messages?.find((m) => m.id === i.messageId)
          if (!message) return "Message not found"
          const current = resolveMessageStatus(message)
          if (!canTransitionMessageStatus(current, i.next)) {
            return `Cannot transition from ${current} to ${i.next}`
          }
          return null
        },
        mutate: (i) => {
          const conv = deps.getConversation?.(i.conversationId)
          const message = conv?.messages?.find((m) => m.id === i.messageId)!
          const patch: Message = {
            ...message,
            status: i.next,
            ...(i.next === "read"
              ? {
                  readAt: Date.now(),
                  readBy: Array.from(new Set([...(message.readBy || []), actorId])),
                }
              : {}),
            ...(i.next === "failed"
              ? {
                  failedAt: Date.now(),
                  failureReason: i.meta?.failureReason || "Network error",
                }
              : {}),
            ...(i.next === "deleted"
              ? { isDeleted: true, deletedAt: Date.now() }
              : {}),
            ...(i.next === "sending" ? { failedAt: undefined, failureReason: undefined } : {}),
          }
          if (deps.repository) {
            deps.repository.update(i.conversationId, i.messageId, patch)
          }
          return { message: patch }
        },
        eventType: "MESSAGE_UPDATED",
        eventPayload: (d, i) => ({
          conversationId: i.conversationId,
          messageId: d.message.id,
          status: i.next,
        }),
      })
    },

    async editMessage(input: {
      conversationId: string
      messageId: string
      newText: string
    }): Promise<MutationResult<{ message: Message }>> {
      return runMutation({
        name: "messaging.edit",
        actorId,
        input,
        validate: (i) => {
          if (!(i.newText || "").trim()) return "Message cannot be empty"
          return null
        },
        authorize: (i) => {
          const gate = evaluateSendPermission({ conversationId: i.conversationId })
          return gate.allowed ? null : gate.reason
        },
        mutate: (i) => {
          const conv = deps.getConversation?.(i.conversationId)
          const message = conv?.messages?.find((m) => m.id === i.messageId)
          if (!message) throw new Error("Message not found")
          if (resolveMessageStatus(message) === "deleted") throw new Error("Message deleted")
          const edited = handleMessageEdit(message, i.newText.trim(), actorId)
          if (!edited) throw new Error("Cannot edit this message")
          if (deps.repository) {
            deps.repository.update(i.conversationId, i.messageId, edited)
          }
          return { message: edited }
        },
        eventType: "MESSAGE_UPDATED",
        eventPayload: (d, i) => ({
          conversationId: i.conversationId,
          messageId: d.message.id,
        }),
      })
    },

    async deleteMessage(
      message: { id: string; senderId: string; createdAt: number; conversationId: string },
      mode: "for_me" | "for_everyone"
    ): Promise<MutationResult<{ messageId: string; mode: string; message?: Message }>> {
      return runMutation({
        name: "messaging.delete",
        actorId,
        input: { message, mode },
        authorize: (i) => {
          if (i.mode === "for_everyone") {
            if (i.message.senderId !== actorId) {
              return "You can only delete your own messages for everyone"
            }
            if (Date.now() - i.message.createdAt > 60 * 60 * 1000) {
              return "Delete-for-everyone window has expired"
            }
          }
          return null
        },
        mutate: (i) => {
          const conv = deps.getConversation?.(i.message.conversationId)
          const full = conv?.messages?.find((m) => m.id === i.message.id) || (i.message as any)
          const engineDeleted = handleMessageDeletion(full, actorId, i.mode === "for_everyone")
          const next = {
            ...(engineDeleted ||
              softDeleteMessage(full as any, actorId, i.mode === "for_everyone" ? "everyone" : "me")),
            status: "deleted" as MessageStatus,
            deletedAt: Date.now(),
          }
          if (deps.repository) {
            deps.repository.update(i.message.conversationId, i.message.id, next as any)
          }
          return { messageId: i.message.id, mode: i.mode, message: next as Message }
        },
        eventType: "MESSAGE_DELETED",
        eventPayload: (d, i) => ({
          conversationId: i.message.conversationId,
          messageId: d.messageId,
          mode: d.mode,
        }),
      })
    },

    async react(
      conversationId: string,
      messageId: string,
      emoji: string
    ): Promise<MutationResult<{ message: Message }>> {
      return runMutation({
        name: "messaging.react",
        actorId,
        input: { conversationId, messageId, emoji },
        validate: (i) => (!(i.emoji || "").trim() ? "Missing reaction" : null),
        authorize: (i) => {
          const gate = evaluateSendPermission({ conversationId: i.conversationId })
          return gate.allowed ? null : gate.reason
        },
        mutate: (i) => {
          const conv = deps.getConversation?.(i.conversationId)
          const message = conv?.messages?.find((m) => m.id === i.messageId)
          if (!message) throw new Error("Message not found")
          const next = handleMessageReaction(message, i.emoji.trim(), actorId, true)
          if (deps.repository) {
            deps.repository.update(i.conversationId, i.messageId, next)
          }
          return { message: next }
        },
      })
    },

    search(conversationId: string, query: string): Message[] {
      const conv = deps.getConversation?.(conversationId)
      if (!conv?.messages) return []
      return searchMessages(conv.messages, { query })
    },

    async createConversation(input: {
      kind: ConversationKind
      participantId?: string
      participantName?: string
      participantPhoto?: string
      name?: string
      memberIds?: string[]
      communityId?: string
    }): Promise<MutationResult<{ conversation: Conversation }>> {
      return runMutation({
        name: "messaging.createConversation",
        actorId,
        input,
        validate: (i) => {
          if (i.kind === "private" && !i.participantId) return "Missing participant"
          if (i.kind === "private" && i.participantId && deps.isBlocked(i.participantId)) {
            return "Cannot start chat with blocked user"
          }
          if (i.kind === "private" && i.participantId) {
            const pctx =
              deps.getPermissionContext?.() ||
              buildPermissionContext({ currentUserId: actorId, blockedUsers: [] })
            if (!canMessageUser(pctx, i.participantId)) {
              return "Messaging not allowed by privacy settings"
            }
          }
          if ((i.kind === "group" || i.kind === "community") && !(i.name || "").trim()) {
            return "Group name required"
          }
          return null
        },
        mutate: (i) => {
          const id = `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
          const now = Date.now()
          const conversation: Conversation = {
            id,
            conversationType: i.kind === "private" ? "private" : "group",
            participantId: i.participantId || "",
            participantName: i.participantName || i.name || "Chat",
            participantPhoto: i.participantPhoto || "/placeholder.svg?width=40&height=40",
            lastMessage: "",
            lastMessageTime: now,
            unread: false,
            unreadCount: 0,
            messages: [],
            ...(i.kind !== "private"
              ? {
                  name: i.name,
                  memberIds: Array.from(new Set([actorId, ...(i.memberIds || [])])),
                  members: Array.from(new Set([actorId, ...(i.memberIds || [])])),
                  roles: { [actorId]: "admin" as const },
                  groupRoles: { [actorId]: i.kind === "community" ? "owner" : "admin" },
                }
              : {}),
            ...(i.kind === "community" || i.communityId
              ? ({ communityId: i.communityId || id, kind: "community" } as any)
              : {}),
          } as Conversation

          deps.upsertConversation?.(conversation)
          return { conversation }
        },
        eventType: "CONVERSATION_CREATED",
        eventPayload: (d) => ({
          conversationId: d.conversation.id,
          kind: input.kind,
        }),
      })
    },

    async markRead(conversationId: string): Promise<MutationResult<{ conversationId: string }>> {
      return runMutation({
        name: "messaging.markRead",
        actorId,
        input: { conversationId },
        mutate: (i) => {
          deps.patchConversation?.(i.conversationId, { unread: false, unreadCount: 0 })
          return { conversationId: i.conversationId }
        },
        eventType: "MESSAGE_READ",
        eventPayload: (d) => ({ conversationId: d.conversationId }),
      })
    },

    async setPinned(
      conversationId: string,
      pinned: boolean
    ): Promise<MutationResult<{ conversationId: string; isPinned: boolean }>> {
      return runMutation({
        name: "messaging.setPinned",
        actorId,
        input: { conversationId, pinned },
        mutate: (i) => {
          const conv = deps.getConversation?.(i.conversationId)
          if (!conv) throw new Error("Conversation not found")
          toggleConversationPin(conv)
          deps.patchConversation?.(i.conversationId, { isPinned: i.pinned } as any)
          return { conversationId: i.conversationId, isPinned: i.pinned }
        },
      })
    },

    async setArchived(
      conversationId: string,
      archived: boolean
    ): Promise<MutationResult<{ conversationId: string; isArchived: boolean }>> {
      return runMutation({
        name: "messaging.setArchived",
        actorId,
        input: { conversationId, archived },
        mutate: (i) => {
          const conv = deps.getConversation?.(i.conversationId)
          if (!conv) throw new Error("Conversation not found")
          toggleConversationArchive(conv)
          deps.patchConversation?.(i.conversationId, { isArchived: i.archived } as any)
          return { conversationId: i.conversationId, isArchived: i.archived }
        },
      })
    },

    async setMuted(
      conversationId: string,
      muted: boolean,
      muteHours?: number
    ): Promise<MutationResult<{ conversationId: string; isMuted: boolean }>> {
      return runMutation({
        name: "messaging.setMuted",
        actorId,
        input: { conversationId, muted, muteHours },
        mutate: (i) => {
          const conv = deps.getConversation?.(i.conversationId)
          if (!conv) throw new Error("Conversation not found")
          toggleConversationMute(conv, i.muteHours)
          deps.patchConversation?.(i.conversationId, { isMuted: i.muted } as any)
          return { conversationId: i.conversationId, isMuted: i.muted }
        },
      })
    },
  }
}

export type MessagingDomain = ReturnType<typeof createMessagingDomain>
