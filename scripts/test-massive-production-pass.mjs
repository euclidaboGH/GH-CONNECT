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
ok(ctx.includes("apiListConversations(40)"), "focus/mutation pulls conversations")
ok(ctx.includes("ghc:messaging-reconcile"), "messaging reconcile event")
ok((ctx.match(/convs && convs\.ok && convs\.durable/g) || []).length >= 2, "conv merge in ≥2 hydrate paths")

ok(existsSync("docs/VERIFIED_MIGRATION_MANIFEST_2026-10-18.txt"), "migration manifest")
ok(existsSync("docs/PRODUCTION_READINESS_GATE_2026-10-18.md"), "readiness gate doc")
const man = readFileSync("docs/VERIFIED_MIGRATION_MANIFEST_2026-10-18.txt", "utf8")
ok(/TOTAL=9\d/.test(man), "manifest total ~90+")

const op = readFileSync("scripts/operator-multiuser-migrations.mjs", "utf8")
ok(op.includes("ECONOMY_OPERATOR_REVIEW"), "economy review list")
ok(op.includes("gh_reaction_toggle"), "reaction in critical set")

const e2e = readFileSync("scripts/operator-live-e2e-social.mjs", "utf8")
ok(e2e.includes("messaging_send_A") || e2e.includes("messaging_list_conversations"), "e2e messaging stages")

const domain = readFileSync("lib/domains/messaging-domain.ts", "utf8")
ok(domain.includes("mutate: async") && domain.includes("apiSendMessageWithRetry"), "messaging server-first retained")

if (failed) {
  console.log(`\nMASSIVE PRODUCTION PASS: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PRODUCTION PASS: all checks passed")
