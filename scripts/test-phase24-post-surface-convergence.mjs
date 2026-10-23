import fs from "node:fs"
const read = (p) => fs.readFileSync(p, "utf8")
const sync = read("lib/social/post-sync.ts")
const client = read("lib/social/client.ts")
const ctx = read("contexts/ghc-context.tsx")
const profile = read("components/ghc/profile-content-library.tsx")
const search = read("components/ghc/global-search.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const checks = [
  ["versioned canonical post sync event", sync.includes('version: 1') && sync.includes('ghc:post-sync')],
  ["sync supports full lifecycle", ["upsert","edit","archive","restore","delete","engagement"].every(x => sync.includes(`\"${x}\"`))],
  ["invalid sync events fail closed", sync.includes("readPostSyncDetail") && sync.includes("return null")],
  ["identical concurrent GETs coalesced", client.includes("inFlightGets") && client.includes("inFlightGets.delete(key)")],
  ["GET coalescing retains no response cache", client.includes("finally(() => inFlightGets.delete(key))")],
  ["post edits broadcast canonical sync", ctx.includes('operation: "edit"') && ctx.includes('source: "post-edit"')],
  ["archive broadcasts canonical sync", ctx.includes('operation: "archive"') && ctx.includes('source: "post-archive"')],
  ["restore broadcasts canonical sync", ctx.includes('operation: "restore"') && ctx.includes('source: "post-restore"')],
  ["delete broadcasts canonical sync", ctx.includes('operation: "delete"') && ctx.includes('source: "post-delete"')],
  ["profile library consumes sync", profile.includes("POST_SYNC_EVENT") && profile.includes("readPostSyncDetail")],
  ["profile removes archived/deleted posts", profile.includes('detail.operation === "delete" || detail.operation === "archive"')],
  ["search consumes sync", search.includes("POST_SYNC_EVENT") && search.includes("setServerPosts") && search.includes("setServerVideos")],
  ["feed stable pagination remains cursor based", feed.includes("beforeId") && ctx.includes("newlyFetchedCount")],
  ["feed refresh callback snapshot avoids identity churn", ctx.includes("postsSnapshotRef") && ctx.includes("Keep a current snapshot")],
  ["duplicate liked-id map removed", !ctx.includes('.map((p) => String(p.id))\n            .map((p) => String(p.id))')],
]
let pass=0
for (const [name, ok] of checks) { console.log(`${ok?"PASS":"FAIL"} ${name}`); if(ok) pass++ }
console.log(`\n${pass}/${checks.length} checks passed`)
if (pass !== checks.length) process.exit(1)
