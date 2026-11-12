/**
 * Single entry to flush all offline durable queues when connectivity returns.
 * Safe to call repeatedly; each submodule is independently fail-soft.
 */
export type FlushAllResult = {
  posts: { attempted: number; succeeded: number; failed: number }
  stories: { attempted: number; succeeded: number; failed: number }
  deletes: { attempted: number; succeeded: number; failed: number }
  listings: { attempted: number; succeeded: number; failed: number }
  conversations?: { attempted: number; succeeded: number; failed: number }
  messages?: { attempted?: number; succeeded?: number; failed?: number }
}

export async function flushAllOfflineQueues(options?: {
  flushMessages?: (args: {
    conversationId: string
    text: string
    messageId?: string
    replyToMessageId?: string
    sharedPostId?: string
  }) => Promise<{ ok: boolean }>
}): Promise<FlushAllResult> {
  const empty = { attempted: 0, succeeded: 0, failed: 0 }
  let posts = empty
  let stories = empty
  let deletes = empty
  let listings = empty
  let conversations = empty
  let messages: FlushAllResult["messages"]

  try {
    const { flushQueuedPosts } = await import("@/lib/social/offline-post-flush")
    posts = await flushQueuedPosts()
  } catch {
    /* */
  }
  try {
    const { flushQueuedStories } = await import("@/lib/social/offline-story-flush")
    stories = await flushQueuedStories()
  } catch {
    /* */
  }
  try {
    const { flushQueuedDeletes } = await import("@/lib/social/offline-delete-flush")
    deletes = await flushQueuedDeletes()
  } catch {
    /* */
  }
  try {
    const { flushQueuedListings } = await import("@/lib/social/offline-listing-flush")
    listings = await flushQueuedListings()
  } catch {
    /* */
  }
  if (options?.flushMessages) {
    try {
      const { flushQueuedMessages } = await import("@/lib/messaging/offline-message-flush")
      const r = await flushQueuedMessages(options.flushMessages)
      messages = {
        attempted: r.attempted,
        succeeded: r.succeeded,
        failed: r.failed,
      }
    } catch {
      /* */
    }
  }

  try {
    const { flushQueuedConversations } = await import("@/lib/messaging/offline-conversation-flush")
    const c = await flushQueuedConversations()
    conversations = { attempted: c.attempted, succeeded: c.succeeded, failed: c.failed }
  } catch {
    /* */
  }

  return { posts, stories, deletes, listings, conversations, messages }
}
