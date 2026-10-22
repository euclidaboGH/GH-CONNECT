import fs from "node:fs"

const feed = fs.readFileSync("app/api/social/feed/route.ts", "utf8")
const profile = fs.readFileSync("app/api/social/profile/[userId]/posts/route.ts", "utf8")
const comments = fs.readFileSync("app/api/social/posts/[id]/comments/route.ts", "utf8")
const profileScreen = fs.readFileSync("components/ghc/profile-screen.tsx", "utf8")
const context = fs.readFileSync("contexts/ghc-context.tsx", "utf8")

const checks = [
  ["feed curation is reconciled from durable vote rows on every refresh", /Always reconcile curation from the durable vote table/.test(feed) && /curationReadSucceeded/.test(feed)],
  ["feed uses durable curation totals when the table read succeeds", /curationReadSucceeded\s*\?\s*\(curation\?\.up\s*\|\|\s*0\)/.test(feed)],
  ["feed does not discard comment previews when stored count is stale zero", /Math\.max\([\s\S]*comments\.length/.test(feed)],
  ["profile endpoint hydrates durable comments and curation", /hydrateProfileEngagement\(visiblePosts, auth\.userId\)/.test(profile)],
  ["profile vote state is resolved by authenticated viewer ID", /String\(vote\.user_id \|\| ""\) === viewerId/.test(profile)],
  ["profile endpoint exposes vote counts and viewer choice", /upvoteCount, downvoteCount, viewerCurationChoice/.test(profile)],
  ["comment list has a canonical REST recovery path for stale RPCs", /const direct = await socialRest/.test(comments) && /gh_post_comments/.test(comments)],
  ["profile timeline maps server-hydrated comments instead of replacing them with empty arrays", /comments: mapProfilePostComments\(row\.comments\)/.test(profileScreen)],
  ["opening a comment thread cannot lower the known durable comment total", context.includes("comments: Math.max(Number(post.engagement?.comments ?? 0) || 0, nextComments.length)")],
  ["comment-list fallback marks successfully read durable rows as durable", comments.includes("durable: rpcReadSucceeded || directReadSucceeded") && comments.includes("Array.isArray(data?.comments)")],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failures++
}
console.log(`\n${checks.length - failures}/${checks.length} post engagement refresh checks passed`)
if (failures) process.exit(1)
