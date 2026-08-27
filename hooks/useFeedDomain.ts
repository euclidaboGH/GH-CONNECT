"use client"

import { useMemo } from "react"
import { useGHC } from "@/contexts/ghc-context"

export function useFeedDomain() {
  const ctx = useGHC()

  return useMemo(
    () => ({
      posts: ctx.posts,
      stories: ctx.stories,
      likedPostIds: ctx.likedPostIds,
      following: ctx.following,
      createPost: ctx.createPost,
      likePost: ctx.likePost,
      deletePost: ctx.deletePost,
      editPost: ctx.editPost,
      addComment: ctx.addComment,
      editComment: ctx.editComment,
      deleteComment: ctx.deleteComment,
      publishStory: ctx.publishStory,
      hidePost: ctx.hidePost,
      reportPost: ctx.reportPost,
      savePost: ctx.savePost,
      sharePost: ctx.sharePost,
    }),
    [
      ctx.posts,
      ctx.stories,
      ctx.likedPostIds,
      ctx.following,
      ctx.createPost,
      ctx.likePost,
      ctx.deletePost,
      ctx.editPost,
      ctx.addComment,
      ctx.editComment,
      ctx.deleteComment,
      ctx.publishStory,
      ctx.hidePost,
      ctx.reportPost,
      ctx.savePost,
      ctx.sharePost,
    ]
  )
}
