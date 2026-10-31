/**
 * Messaging session adapter — maps domain results → conversation session cache.
 * GHCContext remains the React list host for Messages UI compatibility.
 */

import type { Conversation, Message } from "../ghc-types"
import type { DomainMessage } from "./types"

export function applyMessageAppend(
  conversations: Conversation[],
  conversationId: string,
  message: Message
): Conversation[] {
  return conversations.map((c) => {
    if (c.id !== conversationId) return c
    const messages = [...(c.messages || []), message]
    return {
      ...c,
      messages,
      lastMessage: message.text,
      lastMessageTime: message.createdAt || Date.now(),
      unread: false,
    }
  })
}

export function applyMessageUpdate(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  message: Message
): Conversation[] {
  return conversations.map((c) => {
    if (c.id !== conversationId) return c
    return {
      ...c,
      messages: (c.messages || []).map((m) => (m.id === messageId ? message : m)),
      lastMessage:
        c.messages?.[c.messages.length - 1]?.id === messageId ? message.text : c.lastMessage,
    }
  })
}

export function applyConversationUpsert(
  conversations: Conversation[],
  conversation: Conversation
): Conversation[] {
  const exists = conversations.some((c) => c.id === conversation.id)
  if (exists) {
    return conversations.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
  }
  return [conversation, ...conversations]
}

export function applyConversationPatch(
  conversations: Conversation[],
  conversationId: string,
  patch: Partial<Conversation>
): Conversation[] {
  return conversations.map((c) => (c.id === conversationId ? { ...c, ...patch } : c))
}

export function domainMessageToUi(msg: DomainMessage & { uiMessage?: Message }): Message {
  if (msg.uiMessage) return msg.uiMessage
  return {
    id: msg.id,
    senderId: msg.senderId,
    text: msg.text,
    createdAt: msg.createdAt,
    status: (msg.status as Message["status"]) || "sent",
    replyTo: msg.replyToId,
  }
}
