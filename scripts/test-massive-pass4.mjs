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
const mp = readFileSync("components/ghc/marketplace-screen.tsx", "utf8")
ok(mp.includes("Could not publish listing to the server"), "marketplace require durable")
ok(!mp.includes("Listing saved on this device — server not confirmed"), "marketplace no soft local success")

const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
ok(ctx.includes("Could not publish story to the server"), "story server-first")
ok(ctx.includes("Could not create community on the server"), "community create server-first")
ok(ctx.includes("Could not join community on the server"), "community join server-first")
ok(ctx.includes("Could not send join request to the server"), "join request fail-closed")

if (failed) {
  console.log(`\nMASSIVE PASS4: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS4: all checks passed")
