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
ok(ctx.includes("Could not pin message on the server"), "pin fail-closed")
ok(ctx.includes("Could not unpin message on the server"), "unpin fail-closed")
ok(!ctx.includes("Message pinned on this device"), "no soft pin success")

ok(existsSync("lib/economy/program-status.ts"), "program status module")
ok(existsSync("components/ghc/economy-program-status.tsx"), "program status UI")
const rewards = readFileSync("components/ghc/rewards-centre-screen.tsx", "utf8")
ok(rewards.includes("EconomyProgramStatus"), "rewards centre wired")

const prog = readFileSync("lib/economy/program-status.ts", "utf8")
ok(prog.includes("GHC_REFERRAL_SETTLEMENT") && prog.includes("issuanceEnabled: referral"), "referral defaults off via flag")

if (failed) {
  console.log(`\nMASSIVE PASS7: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS7: all checks passed")
