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

ok(existsSync("VERIFIED_MANIFEST.txt"), "current migration manifest exists")
ok(existsSync("docs/PROJECT_TRUTH.md"), "current project truth exists")
const man = readFileSync("VERIFIED_MANIFEST.txt", "utf8")
const project = readFileSync("docs/PROJECT_TRUTH.md", "utf8")
ok(man.includes("inventory_status=BLOCKED_DUPLICATE_VERSION_PREFIXES") || man.includes("inventory_status=OK"), "manifest explicitly reports inventory status")
ok(project.includes("unique 14-digit") && project.includes("CLEAN"), "project truth documents clean migration inventory gate")

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
