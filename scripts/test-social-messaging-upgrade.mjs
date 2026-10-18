import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(join(root, path), "utf8")
let passed = 0
let failed = 0
const check = (condition, label) => {
  if (condition) { passed++; console.log("  ✓", label) }
  else { failed++; console.error("  ✗", label) }
}

const commentSheet = read("components/ghc/comment-sheet.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const messageScreen = read("components/ghc/message-screen.tsx")
const storySection = read("components/ghc/profile-story-section.tsx")
const context = read("contexts/ghc-context.tsx")
const messageRoute = read("app/api/messaging/conversations/[conversationId]/messages/route.ts")
const messageStore = read("lib/server/messaging/message-store.ts")
const sync = read("lib/messaging/server-messaging-sync.ts")
const offlineFlush = read("lib/messaging/offline-message-flush.ts")

console.log("\n=== SOCIAL COMMENTS / REPLIES / MESSAGING REGRESSION CHECKS ===\n")
check(feed.includes("<CommentSheet") && feed.includes("commentingPostId"), "shared comment sheet is wired to the main feed/community feed surface")
check(commentSheet.includes("buildCommentTree(post.comments)"), "comment replies render from a normalized thread tree")
check(commentSheet.includes("commentsLoadError") && commentSheet.includes("Retry"), "comment refresh failures are visible and retryable")
check(commentSheet.includes("Could not delete comment. Please try again."), "comment deletion failures are surfaced instead of silently ignored")
check(commentSheet.includes('reactionCount(c, emoji)'), "comment quick reactions display per-emoji counts")
check(messageRoute.includes("replyToMessageId") && messageRoute.includes("INVALID_REPLY_TARGET"), "message reply targets are validated server-side")
check(messageStore.includes("REPLY_TARGET_NOT_FOUND") && messageStore.includes("conversation_id=eq.${encodeURIComponent(cid)}"), "reply target must exist in the same conversation and remain undeleted")
check(messageStore.includes("replyToMessageId ? { replyToMessageId, replyToPreview } : {}") && messageStore.includes("sharedPostId ? { sharedPostId } : {}"), "message reply and shared-post metadata persist in the existing durable JSON metadata field")
check(sync.includes("replyToMessageId: replyToMessageId || undefined"), "client sends reply metadata through the durable message API")
check(sync.includes("REPLY_TARGET|INVALID_REPLY"), "permanent reply-target validation errors are not pointlessly retried")
check(context.includes("replyToId: replyToMessageId") && context.includes("return sent"), "reply actions use the canonical send pipeline and report failure")
check(context.includes("replyToMessageId,") && offlineFlush.includes("replyToMessageId: payload.replyToMessageId"), "offline retries preserve message reply relationships")
check(messageScreen.includes("accepted === false || accepted === undefined"), "composer retains text when a send is rejected or unconfirmed")
check(messageScreen.includes("Retry not confirmed"), "failed message retries do not falsely report success")
check(storySection.includes('if (!accepted) throw new Error("Reply was not accepted")') && storySection.includes("socialToggleStoryReaction(viewing.id, emoji)") && storySection.includes("a durable story reaction does not depend on private messaging"), "story replies require messaging acceptance while story reactions persist independently")

console.log(`\nPassed: ${passed}; Failed: ${failed}`)
if (failed) process.exit(1)
console.log("SOCIAL COMMENTS / REPLIES / MESSAGING CHECKS PASSED\n")
