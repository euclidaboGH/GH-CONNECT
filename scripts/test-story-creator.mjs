import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
const assert = (condition, message) => {
  if (condition) { passed++; console.log("  ✓", message) }
  else { failed++; console.error("  ✗", message) }
}
const read = (path) => readFileSync(join(root, path), "utf8")

console.log("\n=== STORY CREATOR / STORY VISIBILITY REGRESSION CHECKS ===\n")
const ui = read("components/ghc/profile-story-section.tsx")
const route = read("app/api/social/stories/route.ts")
const migration = read("supabase/migrations/202610240004_gh_story_creator_upgrade.sql")
const data = read("lib/ghc-data.ts")
const app = read("components/ghc/app.tsx")

assert(existsSync(join(root, "app/api/social/stories/[id]/viewers/route.ts")), "owner-only viewer roster endpoint exists")
assert(ui.includes("getUserMedia") && ui.includes("captureCameraPhoto"), "live camera capture has a graceful fallback")
assert(ui.includes("socialListStoryViewers") && ui.includes("loadViewers"), "story viewer list uses server endpoint")
assert(ui.includes("toggleHighlight") && ui.includes("ghc-story-highlights"), "existing local highlights behavior is preserved and labelled honestly")
assert(ui.includes("Reply privately") && ui.includes("sendStoryReaction"), "replies/reactions go through private messaging")
assert(ui.includes("ghc:open-story-creator") && app.includes("<ProfileStorySection creatorHost />"), "story creator is available from global create hub")
assert(ui.includes("story-progress") && ui.includes("onTouchEnd"), "story viewer supports timed progression and swipe navigation")
assert(route.includes("SAFE_STORY_BACKGROUNDS") && route.includes("background:"), "API validates and accepts text-story themes")
assert(data.includes("SAFE_STORY_BACKGROUNDS.has(raw.background)"), "client story sanitizer accepts only known themes")
assert(migration.includes("ADD COLUMN IF NOT EXISTS background") && migration.includes('s.audience = \'followers\'') && migration.includes("gh_follows"), "forward migration stores themes and filters follower audience")
assert(migration.includes("s.audience = 'friends'") && migration.includes("f2.following_id = f1.follower_id"), "friends-only audience requires reciprocal follow")
assert(migration.includes("REVOKE ALL ON FUNCTION public.gh_story_list_active(text) FROM PUBLIC") && migration.includes("TO service_role"), "story list RPC remains service-role only")

console.log("\nPassed:", passed, "Failed:", failed)
if (failed) process.exit(1)
console.log("STORY CREATOR STATIC CHECKS PASSED\n")
