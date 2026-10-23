import fs from "node:fs"
const hub = fs.readFileSync("components/ghc/premium-community-hub.tsx", "utf8")
const commentApi = fs.readFileSync("app/api/social/posts/[id]/comments/route.ts", "utf8")
const client = fs.readFileSync("lib/social/client.ts", "utf8")
const checks = [
  ["durable community discussion opens canonical post comments", hub.includes('action: "comment", source: "community"')],
  ["durable community discussion routes through global post resolver", hub.includes('new CustomEvent("ghc:open-post"')],
  ["durable discussion upvote uses canonical curation", hub.includes('curateCommunityPost(String(p.id), "upvote")')],
  ["durable discussion downvote uses canonical curation", hub.includes('curateCommunityPost(String(p.id), "downvote")')],
  ["legacy discussion remains explicitly isolated", hub.includes('Like legacy discussion')],
  ["legacy local replies are gated to legacy ids", hub.includes('open && (String(p.id || "").startsWith("bpost_")')],
  ["canonical comments support parent ids", client.includes('parentId?: string')],
  ["canonical comments use server endpoint", client.includes('/comments`,')],
  ["comment API is visibility gated", commentApi.includes('canViewSocialPost')],
]
let pass=0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if(ok) pass++ }
console.log(`\n${pass}/${checks.length} PASS`)
if(pass !== checks.length) process.exit(1)
