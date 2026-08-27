"use client"

import { useMemo } from "react"
import { useGHC } from "@/contexts/ghc-context"
import { getBackend } from "@/lib/backend"

export function useDiscoveryDomain() {
  const ctx = useGHC()
  const backend = getBackend()

  return useMemo(
    () => ({
      candidates: ctx.candidates,
      matches: ctx.matches,
      likes: ctx.likes,
      friendRequests: ctx.friendRequests,
      following: ctx.following,
      swipe: ctx.swipe,
      followUser: ctx.followUser,
      blockUser: ctx.blockUser,
      reportUser: ctx.reportUser,
      startConversation: ctx.startConversation,
      acceptMatch: ctx.acceptMatch,
      rejectMatch: ctx.rejectMatch,
      /** Structured matching API (backend adapter). */
      matchingApi: backend.matching,
      moderationApi: backend.moderation,
    }),
    [
      ctx.candidates,
      ctx.matches,
      ctx.likes,
      ctx.friendRequests,
      ctx.following,
      ctx.swipe,
      ctx.followUser,
      ctx.blockUser,
      ctx.reportUser,
      ctx.startConversation,
      ctx.acceptMatch,
      ctx.rejectMatch,
      backend.matching,
      backend.moderation,
    ]
  )
}
