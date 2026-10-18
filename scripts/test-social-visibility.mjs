import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const checks = []
const check = (name, ok) => { checks.push({ name, ok: Boolean(ok) }); console.log(`  ${ok ? "✓" : "✗"} ${name}`) }

console.log("\n=== SOCIAL ENGAGEMENT VISIBILITY ===\n")
const feedRoute = read("app/api/social/feed/route.ts")
check("feed engagement is hydrated with batched comments and reactions", feedRoute.includes("hydrateFeedEngagement") && feedRoute.includes("gh_post_comments?") && feedRoute.includes("gh_post_reactions?"))
check("feed engagement hydration fails soft and does not fail feed", feedRoute.includes("engagement previews are an enhancement"))
const context = read("contexts/ghc-context.tsx")
check("remote feed maps comment counts, reaction counts and viewer reactions", context.includes("const commentCount = Number(p.commentCount") && context.includes("reactionCounts,") && context.includes("viewerReactions,"))
const card = read("components/ghc/enhanced-post-card.tsx")
check("post cards show likes, comments, shares and reaction counts", card.includes("visibleLikeCount") && card.includes("visibleCommentCount") && card.includes("visibleShareCount") && card.includes("visibleReactionEntries"))
check("post media and card body open full post detail", card.includes("onOpenPost?.(post.id)") && card.includes("onClick={(event) => {\n        const target"))
const detail = read("components/ghc/post-detail-sheet.tsx")
check("full post view includes complete content, media, comments and engagement totals", detail.includes("Full post") && detail.includes("Recent comments") && detail.includes("onOpenMedia"))
const feedScreen = read("components/ghc/enhanced-feed-screen.tsx")
check("feed mounts full post detail and hydrates comments on open", feedScreen.includes("<PostDetailSheet") && feedScreen.includes("loadComments={loadPostComments}"))
const stories = read("components/ghc/profile-story-section.tsx")
check("story rail shows media/text previews before opening a story", stories.includes("Stories & moments") && stories.includes("story.text || \"A moment shared\""))
check("story reactions are saved durably and show aggregate counts", stories.includes("socialToggleStoryReaction") && stories.includes("storyReactionOverrides"))
const storyRoute = read("app/api/social/stories/[id]/reactions/route.ts")
check("story reaction API authenticates and rate limits writes", storyRoute.includes("resolveAuthenticatedUser") && storyRoute.includes("checkRateLimit"))
const migration = read("supabase/migrations/202610240006_gh_story_reactions.sql")
check("story reactions migration has RLS, safe RPC and service-role-only execute", migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("gh_story_reaction_toggle") && migration.includes("REVOKE ALL ON FUNCTION"))
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
check("package and lock versions match", pkg.version === lock.version && pkg.version === lock.packages?.[""]?.version)

const failed = checks.filter((item) => !item.ok)
console.log(`\n=== RESULTS: ${checks.length - failed.length} passed, ${failed.length} failed ===`)
if (failed.length) process.exitCode = 1
