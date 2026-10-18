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
const bell = readFileSync("components/ghc/notification-bell.tsx", "utf8")
ok(bell.includes('socialType === "message"'), "maps message social type")
ok(bell.includes("conversationId"), "carries conversationId")

const nc = readFileSync("lib/notification-center.ts", "utf8")
ok(nc.includes("entityType === \"conversation\""), "extracts entity conversation")
ok(nc.includes("ghc:open-conversation"), "opens conversation event")
ok(nc.includes("peerUserId"), "passes peerUserId")
ok(nc.includes("openChat"), "fallback openChat")

const ms = readFileSync("components/ghc/message-screen.tsx", "utf8")
ok(ms.includes("pendingOpenRef"), "pending open while list loads")
ok(ms.includes("peerUserId"), "resolves peer")
ok(ms.includes("Flush deep-link open"), "flushes when conversations hydrate")

if (failed) {
  console.log(`\nMESSAGE DEEPLINK: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMESSAGE DEEPLINK: all checks passed")
