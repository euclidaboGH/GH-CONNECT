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
const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
ok(ctx.includes("Could not publish post to the server"), "createPost server-first")
ok(ctx.includes("Could not approve join on the server"), "approve server-first")
ok(ctx.includes("Could not decline join on the server"), "decline server-first")
ok(ctx.includes("Profile saved on this device — server not confirmed"), "profile honest persist")
ok(ctx.includes("publishedPost"), "createPost uses published id")

if (failed) {
  console.log(`\nMASSIVE PASS5: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS5: all checks passed")
