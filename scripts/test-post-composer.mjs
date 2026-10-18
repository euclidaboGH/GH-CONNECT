import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
let passed = 0
let failed = 0
const assert = (condition, message) => {
  if (condition) { passed++; console.log("  ✓", message) }
  else { failed++; console.error("  ✗", message) }
}

const composer = read("components/ghc/unified-compose.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const card = read("components/ghc/enhanced-post-card.tsx")
const app = read("components/ghc/app.tsx")
const rewardPanel = read("components/ghc/post-reward/post-reward-panel.tsx")
const drafts = read("lib/creator/post-drafts.ts")

console.log("\n=== POST COMPOSER / FEED REGRESSION CHECKS ===\n")
assert(composer.includes('window.addEventListener("ghc:open-compose", onOpenCompose)'), "composer accepts feed compose events")
assert(composer.includes("getPostDraft(pending.draftId)"), "saved draft selection restores the full draft")
assert(composer.includes("activeDraftIdRef.current || undefined"), "saving an open draft updates it instead of duplicating it")
assert(composer.includes("removePostDraft(activeDraftIdRef.current)"), "successfully published drafts are removed")
assert(!composer.includes("ghc-scheduled-posts") && !composer.includes("Schedule (optional)"), "composer does not pretend device-only scheduling is a real scheduler")
assert(!composer.includes("{/* Mode tabs */}"), "post and story creation are separate focused flows")
assert(composer.includes('new CustomEvent("ghc:open-poll")') && app.includes('addEventListener("ghc:open-poll"'), "poll creation opens the existing poll composer")
assert(composer.includes("selectedImages.filter((u) => !isDurableMediaUrl(u))"), "device-only photos cannot be silently published as durable media")
assert(composer.includes("selectedVideo && !isDurableMediaUrl(selectedVideo)"), "device-only video cannot be silently published")
assert(composer.includes("selectedDoc && !isDurableMediaUrl(selectedDoc)"), "device-only attachments cannot be silently published")
assert(composer.includes("Boolean(uploadProgress)"), "publishing is disabled during media upload")
assert(card.includes("Community review status is loaded only on its dedicated detail surface") && !card.includes('fetch(`/api/social/posts/${encodeURIComponent(post.id)}/ghpv`'), "feed cards avoid one unused network request per post")
assert(rewardPanel.includes("if (!open) return") && rewardPanel.includes("[open, postId]"), "reward details fetch on demand rather than once for every feed card")
assert(rewardPanel.includes("do not mint GHC by themselves"), "reward UI explains that votes alone do not mint GHC")
assert(feed.includes('detail: { mode: "post", draftId: d.id, text: d.content }'), "feed draft action passes the selected draft identity")
assert(drafts.includes('window.dispatchEvent(new CustomEvent("ghc:post-drafts-changed"'), "draft updates notify the feed draft list")

console.log("\nPassed:", passed, "Failed:", failed)
if (failed) process.exit(1)
console.log("POST COMPOSER STATIC CHECKS PASSED\n")
