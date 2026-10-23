import fs from "node:fs"
const read=(p)=>fs.readFileSync(p,"utf8")
const client=read("lib/social/client.ts")
const ctx=read("contexts/ghc-context.tsx")
const rank=read("lib/feed-ranking-engine.ts")
const feed=read("components/ghc/enhanced-feed-screen.tsx")
const search=read("components/ghc/global-search.tsx")
const api=read("app/api/social/feed/route.ts")
const checks=[
 ["feed fetch supports abort signal", client.includes("signal?: AbortSignal") && client.includes("{ signal: opts.signal }")],
 ["signalled reads bypass shared coalescing", client.includes('method === "GET" && !init?.signal')],
 ["refresh has generation coordinator", ctx.includes("feedRequestRef") && ctx.includes("STALE_FEED_RESPONSE")],
 ["new refresh aborts superseded request", ctx.includes("controller?.abort()") && ctx.includes("FEED_REQUEST_SUPERSEDED")],
 ["stable cursor remains", api.includes("beforeId") && api.includes("gh_post_list_feed_v3")],
 ["for-you filters muted authors", rank.includes("(context.mutedUserIds || []).includes(post.authorId)")],
 ["for-you diversity guard", rank.includes("diversifyRankedFeed") && rank.includes("maxConsecutiveAuthor = 2")],
 ["trending uses quality explanation", rank.includes("discussion, saves and shares")],
 ["latest chronology corrected", rank.includes("let score = post.createdAt || 0")],
 ["feed supports canonical lanes", ["for-you","following","friends","communities","trending"].every(x=>feed.includes(`value: \"${x}\"`))],
 ["search cancels stale network requests", search.includes("new AbortController()") && search.includes("ac.abort()")],
 ["search reconciles post lifecycle", search.includes("POST_SYNC_EVENT") && search.includes("readPostSyncDetail")],
 ["feed offline state retained", feed.includes('window.addEventListener("offline"') && feed.includes('window.addEventListener("online"')],
]
let pass=0
for(const [n,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${n}`); if(ok)pass++}
console.log(`Phase 25: ${pass}/${checks.length}`)
if(pass!==checks.length)process.exit(1)
