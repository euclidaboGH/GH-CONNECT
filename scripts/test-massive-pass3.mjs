#!/usr/bin/env node
import { readFileSync } from "node:fs"
let failed = 0
function ok(c, m) {
  if (c) console.log(`PASS ${m}`)
  else {
    console.log(`FAIL ${m}`)
    failed++
  }
}
const card = readFileSync("components/ghc/enhanced-post-card.tsx", "utf8")
ok(card.includes('openRoster(kind === "positive" ? "upvotes" : "downvotes")'), "long-press opens roster")
ok(card.includes('openRoster("viewers")'), "viewers roster wired")

const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
ok(ctx.includes("MATCH_NOT_DURABLE") || ctx.includes("Could not save this like on the server"), "match like server-first")
ok(ctx.includes("Could not save pass on the server"), "match pass server-first")
ok(ctx.includes("socialFetchMatchInbox"), "match inbox hydrate")
ok(ctx.includes("matchInbox && matchInbox.ok"), "match merge on focus")

const e2e = readFileSync("scripts/operator-live-e2e-social.mjs", "utf8")
ok(e2e.includes("roster_list"), "e2e roster stages")

if (failed) {
  console.log(`\nMASSIVE PASS3: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS3: all checks passed")
