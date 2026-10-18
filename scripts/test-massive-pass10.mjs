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
ok(existsSync("lib/social/offline-listing-flush.ts"), "listing flush module")
ok(existsSync("lib/offline/flush-all.ts"), "unified flush orchestrator")
const mkt = readFileSync("components/ghc/marketplace-screen.tsx", "utf8")
ok(mkt.includes('type: "create_listing"'), "marketplace offline queue")
ok(mkt.includes("will publish when you're back online") || mkt.includes("Listing saved offline"), "offline listing message")
const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
ok(ctx.includes("flushQueuedListings"), "listing flush wired in context")
ok(ctx.includes("Queued listing published"), "listing flush toast")
ok(!ctx.includes("Saved on this device — server publish not confirmed"), "dead createPost soft branch removed")
const orch = readFileSync("lib/offline/flush-all.ts", "utf8")
ok(orch.includes("flushQueuedPosts") && orch.includes("flushQueuedListings"), "orchestrator covers posts+listings")

if (failed) {
  console.log(`\nMASSIVE PASS10: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS10: all checks passed")
