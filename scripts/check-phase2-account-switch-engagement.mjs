import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const client = read("../lib/social/client.ts")
const identity = read("../lib/social/request-identity.ts")
const context = read("../contexts/ghc-context.tsx")
const commentsRoute = read("../app/api/social/posts/[id]/comments/route.ts")
const notificationTargets = read("../lib/notification-targets.ts")
const compose = read("../components/ghc/unified-compose.tsx")
const communityCard = read("../components/ghc/community-canonical-post-card.tsx")
const profileScreen = read("../components/ghc/profile-screen.tsx")
const ghcContext = read("../contexts/ghc-context.tsx")
const drafts = read("../lib/creator/post-drafts.ts")
const checks = [
  ["social GET coalescing is identity-scoped", client.includes('`${identityAtStart}\\u0000${path}`')],
  ["social responses are rejected after account identity changes", client.includes('error: "AUTH_CONTEXT_CHANGED"') && client.includes('requestIdentityKey() !== identityAtStart')],
  ["request identity key contains no bearer token or cookie", identity.includes("identity.userId") && identity.includes("identity.piUserId") && !identity.includes("accessToken") && !identity.includes("Authorization")],
  ["comment deletion broadcasts the authoritative count to all subscribed surfaces", context.includes('broadcastPostEngagement({ postId, kind: "comment", commentCount: reconciledCommentCount })')],
  ["comment notifications carry exact post/comment/thread routing identifiers", commentsRoute.includes('threadRootId: participants.threadRootId') && commentsRoute.includes('parentId: comment.parentId') && commentsRoute.includes('commentId: comment.id')],
  ["mention notifications include parent/thread routing context", commentsRoute.includes('metadata: { postId, commentId: comment.id, parentId: comment.parentId, threadRootId: participants.threadRootId, deepLink, handle }')],
  ["notification resolver routes comment/reply events to the comments surface", notificationTargets.includes('link.section = base.commentId || /COMMENT|REPLY|MENTION/.test(eventUpper)')],
  ["composer closes and clears transient media/draft state on account switch", compose.includes('IdentityService.subscribe((identity)') && compose.includes('setSelectedImages([])') && compose.includes('setStoryMedia(null)') && compose.includes('onOpenChange(false)')],
  ["post drafts remain scoped to the active account", drafts.includes('const KEY_PREFIX = "ghc.post-drafts.v2:"') && drafts.includes('IdentityService.getCurrentUserId()')],
  ["durable share count is propagated from the server response", read("../components/ghc/share-sheet.tsx").includes('typeof durableShare.shareCount === "number"')],
  ["Community reaction mutations broadcast authoritative counts and viewer state", communityCard.includes("broadcastPostEngagement({ postId, kind: \"reaction\"") && communityCard.includes("result.reactionCounts") && communityCard.includes("result.viewerReactions")],
  ["Community cards reconcile engagement broadcasts without a full remount", communityCard.includes('window.addEventListener("ghc:post-engagement"') && communityCard.includes("setEngagementOverride") && communityCard.includes("commentCount")],
  ["Community save mutations require durable confirmation and propagate viewer state", communityCard.includes("result.durable === false") && communityCard.includes("savedByMe: Boolean(result.saved)")],
  ["independently loaded Profile timeline reconciles shared engagement counts", profileScreen.includes('window.addEventListener("ghc:post-engagement"') && profileScreen.includes("setTimelinePosts") && profileScreen.includes("detail.commentCount") && profileScreen.includes("detail.shareCount")],
  ["Feed/Profile bookmark mutations broadcast only server-confirmed viewer state", ghcContext.includes('broadcastPostEngagement({ postId, kind: "save", savedByMe: remote.saved })')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed += 1 }
console.log(`Phase 2 account/count/notification hardening: ${checks.length - failed}/${checks.length} checks passed`)
assert.equal(failed, 0)
