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
ok((ctx.match(/socialDiscoverPeople/g) || []).length >= 3, "discover people in multiple paths")
ok(ctx.includes("people && people.ok"), "people merge in hydrate")
ok(ctx.includes("remote.durable !== false") || ctx.includes("durable !== false"), "offline flush accepts durable!==false")

ok(existsSync("docs/TESTNET_EVIDENCE_PLAYBOOK_2026-10-18.md"), "testnet playbook")
ok(existsSync("docs/PRODUCTION_READINESS_GATE_2026-10-18.md"), "production gate retained")

const idor = readFileSync("scripts/test-idor-static.mjs", "utf8")
ok(idor.includes("messaging") || idor.includes("app/api"), "idor scanner present")

if (failed) {
  console.log(`\nMASSIVE PASS2: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS2: all checks passed")
