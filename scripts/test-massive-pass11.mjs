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
ok((ctx.match(/const base: Conversation = existing \?\?/g) || []).length >= 2, "conversation hydrate typed")
ok(ctx.includes("ensureConversation"), "ensureConversation imported/used")
ok(ctx.includes("Could not create conversation on the server"), "startConversation server-first")
ok(ctx.includes('type: "create_conversation"'), "offline create_conversation queue")
ok(ctx.includes("flushQueuedConversations"), "conversation flush wired")
ok(existsSync("lib/messaging/ensure-conversation.ts"), "ensure-conversation module")
ok(existsSync("lib/messaging/offline-conversation-flush.ts"), "offline conversation flush")
ok(existsSync("docs/PHASE5_SOURCE_AUDIT_AND_PASS11_2026-10-19.md"), "audit doc")

if (failed) {
  console.log(`\nMASSIVE PASS11: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMASSIVE PASS11: all checks passed")
