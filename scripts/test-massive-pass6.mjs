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
ok(ctx.includes("Could not save post edit on the server"), "edit fail-closed")
ok(ctx.includes("Could not archive post on the server"), "archive fail-closed")
ok(ctx.includes("Could not restore post on the server"), "unarchive fail-closed")
ok(ctx.includes("Could not save post on the server"), "save fail-closed")
ok(ctx.includes("Could not publish quote on the server") || ctx.includes("Quote repost published"), "quote server-first")
ok(!ctx.includes('Quote repost saved on this device'), "no soft quote success")
ok(!ctx.includes('Post archived on this device'), "no soft archive success")

if (failed) {
  console.log(`\nMASSIVE PASS6: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS6: all checks passed")
