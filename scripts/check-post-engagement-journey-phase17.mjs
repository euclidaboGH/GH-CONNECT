#!/usr/bin/env node
import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const api = read("app/api/social/posts/[id]/comments/route.ts")
const client = read("lib/social/client.ts")
const context = read("contexts/ghc-context.tsx")
const sheet = read("components/ghc/comment-sheet.tsx")
const reactionRoute = read("app/api/social/posts/[id]/comments/[commentId]/reactions/route.ts")
const shareRoute = read("app/api/social/posts/[id]/share/route.ts")
const notificationRoute = read("app/api/social/notifications/route.ts")
const postReactionRoute = read("app/api/social/posts/[id]/reactions/route.ts")
const shareSheet = read("components/ghc/share-sheet.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const postDetail = read("components/ghc/post-detail-sheet.tsx")

assert.match(api, /beforeId[\s\S]*INVALID_CURSOR/, "comment API validates stable cursor pairs")
assert.match(api, /gh_comment_list_v3/, "comment pages use the canonical durable thread RPC")
assert.match(api, /stableCursor:\s*true/, "comment API declares stable cursor support")
assert.match(client, /beforeId[\s\S]*socialListComments/, "social client transports the composite cursor")
assert.match(context, /limit:\s*40[\s\S]*before:\s*options\?\.before[\s\S]*beforeId:\s*options\?\.beforeId/, "context requests bounded cursor pages")
assert.match(context, /options\?\.append \|\| !remote\.durable/, "append mode preserves earlier pages while durable refreshes remain authoritative")
assert.match(context, /nextCursor:\s*remote\.nextCursor \|\| null/, "context returns the next server cursor")
assert.match(sheet, /commentsLoadingMore/, "thread UI has a separate load-more state")
assert.match(sheet, /append:\s*true/, "load older action appends rather than replacing comments")
assert.match(sheet, /Load older comments/, "thread UI exposes server pagination")
assert.match(sheet, /Show .*more loaded comments/, "locally hidden loaded comments remain distinct from server pages")
assert.match(sheet, /aria-live="polite"/, "pagination feedback is announced accessibly")
assert.match(reactionRoute, /resolveAuthenticatedUser[\s\S]*checkRateLimit/, "comment reactions require a session and rate limit")
assert.match(shareRoute, /canViewSocialPost[\s\S]*gh_post_share[\s\S]*emitSocialNotification/, "post sharing remains visibility-gated and notifies through the durable channel")
assert.match(notificationRoute, /recipientUserId|auth\.userId/, "notification reads are scoped to the authenticated recipient")

assert.match(postReactionRoute, /if \(active\)[\s\S]*type: "post_like"[\s\S]*reaction:/, "every active reaction emits durable author feedback")
assert.match(shareSheet, /socialSharePost\(post\.id\)[\s\S]*durableShare\.durable !== true/, "share completion waits for durable server confirmation")
assert.match(shareSheet, /broadcastPostEngagement\([\s\S]*shareCount/, "share counts propagate through the shared engagement bus")
assert.doesNotMatch(feed, /socialSharePost\(pid\)/, "share sheet does not double-submit the durable share edge")

assert.match(postDetail, /commentsLoadError[\s\S]*Recent comments could not be loaded[\s\S]*Try again/, "post details distinguish a failed comments read from a true empty discussion")

console.log("Social engagement journey Phase 17: 19/19 checks passed")
