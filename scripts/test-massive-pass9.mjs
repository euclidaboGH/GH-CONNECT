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
const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
ok(ctx.includes("Could not delete post on the server"), "delete fail-closed")
ok(ctx.includes('type: "delete_post"'), "delete offline queue")
ok(ctx.includes('type: "create_story"'), "story offline queue")
ok(ctx.includes("flushQueuedStories"), "story flush wired")
ok(ctx.includes("flushQueuedDeletes"), "delete flush wired")
ok(ctx.includes("device-local only") || ctx.includes("this device only"), "local prefs honest")
ok(!ctx.includes('addToast("Voice note sent on this device", "success")'), "no false voice success")
ok(existsSync("lib/social/offline-story-flush.ts"), "story flush module")
ok(existsSync("lib/social/offline-delete-flush.ts"), "delete flush module")
const e2e = readFileSync("scripts/operator-live-e2e-social.mjs", "utf8")
ok(e2e.includes("story_create_A"), "e2e story probe")
ok(e2e.includes("marketplace_list_A"), "e2e marketplace probe")

if (failed) {
  console.log(`\nMASSIVE PASS9: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS9: all checks passed")
