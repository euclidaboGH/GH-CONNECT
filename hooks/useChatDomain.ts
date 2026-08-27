"use client"

import { useMemo } from "react"
import { useGHC } from "@/contexts/ghc-context"

export function useChatDomain() {
  const ctx = useGHC()

  return useMemo(
    () => ({
      conversations: ctx.conversations,
      sendMessage: ctx.sendMessage,
      editMessage: ctx.editMessage,
      deleteMessage: ctx.deleteMessage,
      replyToMessage: ctx.replyToMessage,
      forwardMessage: ctx.forwardMessage,
      addMessageReaction: ctx.addMessageReaction,
      markConversationRead: ctx.markConversationRead,
      pinConversation: ctx.pinConversation,
      archiveConversation: ctx.archiveConversation,
      muteConversation: ctx.muteConversation,
      startConversation: ctx.startConversation,
      saveDraft: ctx.saveDraft,
      loadDraft: ctx.loadDraft,
      canMessageUser: ctx.canMessageUser,
    }),
    [
      ctx.conversations,
      ctx.sendMessage,
      ctx.editMessage,
      ctx.deleteMessage,
      ctx.replyToMessage,
      ctx.forwardMessage,
      ctx.addMessageReaction,
      ctx.markConversationRead,
      ctx.pinConversation,
      ctx.archiveConversation,
      ctx.muteConversation,
      ctx.startConversation,
      ctx.saveDraft,
      ctx.loadDraft,
      ctx.canMessageUser,
    ]
  )
}
