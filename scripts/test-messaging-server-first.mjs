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
const domain = readFileSync("lib/domains/messaging-domain.ts", "utf8")
const start = domain.indexOf("async sendMessage")
const end = domain.indexOf("async setMessageStatus")
const body = domain.slice(start, end)
ok(body.includes("mutate: async"), "send mutate is async")
ok(body.includes("apiSendMessageWithRetry"), "calls durable API")
ok(body.includes("MESSAGE_NOT_DURABLE") || body.includes("throw new Error"), "throws when not durable online")
ok(body.includes('status: "sending"'), "offline uses sending")
ok(!body.includes("void apiSendMessageWithRetry"), "no fire-and-forget send")

const create = domain.slice(domain.indexOf("async createConversation"), domain.indexOf("async createConversation") + 2500)
ok(create.includes("shouldAttemptDurableMessaging"), "create requires durable when online")
ok(create.includes("Cannot start chat"), "create fails closed online")

if (failed) {
  console.log(`\nMESSAGING SERVER-FIRST: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nMESSAGING SERVER-FIRST: all checks passed")
