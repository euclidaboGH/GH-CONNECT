#!/usr/bin/env node
import { readFileSync } from "node:fs"
const t = readFileSync("contexts/ghc-context.tsx", "utf8")
let failed = 0
function ok(c, m) {
  if (c) console.log(`PASS ${m}`)
  else {
    console.log(`FAIL ${m}`)
    failed++
  }
}
// Match the current React useCallback declaration; the old `= async` matcher
// silently returned an empty slice after addComment was memoized.
const addStart = t.indexOf("const addComment = useCallback(async")
const addEnd = t.indexOf("\n  const deleteComment", addStart)
const chunk = addStart >= 0 && addEnd > addStart ? t.slice(addStart, addEnd) : ""
ok(chunk.includes("socialAddComment"), "addComment uses socialAddComment")
ok(chunk.includes("Server-first") || chunk.includes("server-first") || chunk.includes("Server-first"), "server-first comment")
ok(chunk.indexOf("socialAddComment") < chunk.indexOf("setState"), "remote before local setState")
ok(chunk.includes("durable === false"), "rejects non-durable")
ok(chunk.includes("Number.isFinite(remote.commentCount)") && chunk.includes("currentCommentCount + (remote.idempotent ? 0 : 1)"), "uses the authoritative persisted comment count and handles idempotent retries")
ok(chunk.includes("Math.max(") && chunk.includes("mapped.length") && chunk.includes("remote.commentCount"), "reconciliation preserves the authoritative total rather than replacing it with the loaded page size")
ok(chunk.includes("pendingCommentRequestIdsRef") && chunk.includes("id: requestId"), "retries reuse a stable comment request ID to prevent duplicate rows")
ok(!chunk.includes("domains.posts.addComment"), "no local-only domain comment first")

const reactStart = t.indexOf("const addCommentReaction = useCallback(async")
const reactEnd = t.indexOf("const removeCommentReaction", reactStart)
const rchunk = reactStart >= 0 && reactEnd > reactStart ? t.slice(reactStart, reactEnd) : ""
ok(rchunk.includes("/comments/") && rchunk.includes("/reactions"), "reaction hits API")
ok(rchunk.includes("durable === false"), "reaction rejects non-durable")

const load = t.slice(t.indexOf("const loadPostComments"), t.indexOf("const loadPostComments") + 2500)
ok(load.includes("!remote.durable"), "loadPostComments durable authority")

const sheet = readFileSync("components/ghc/comment-sheet.tsx", "utf8")
ok(sheet.includes("loadPostComments"), "sheet reloads comments")
ok(sheet.includes("ghc:social-mutation"), "sheet listens for social mutations")

if (failed) {
  console.log(`\nCOMMENT SERVER-FIRST: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nCOMMENT SERVER-FIRST: all checks passed")
