#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
let failed = 0
function ok(c, m) {
  if (c) console.log(`PASS ${m}`)
  else {
    console.log(`FAIL ${m}`)
    failed++
  }
}
ok(existsSync("lib/social/offline-post-flush.ts"), "offline post flush module")
const flush = readFileSync("lib/social/offline-post-flush.ts", "utf8")
ok(flush.includes("socialCreatePost") && flush.includes("create_post"), "flushes create_post via social API")
ok(flush.includes("durable !== false"), "requires durable success")

const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
ok(ctx.includes("flushQueuedPosts"), "context wires post flush")
ok(ctx.includes("Queued post published") || ctx.includes("queued posts published"), "toast on flush success")
ok(ctx.includes("/api/social/posts/") && ctx.includes("Comment pinned"), "comment pin is server-backed and honest")
ok(!ctx.includes('addToast("Comment pinned on this device", "success")'), "no false success on pin")

if (failed) {
  console.log(`\nMASSIVE PASS8: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS8: all checks passed")
