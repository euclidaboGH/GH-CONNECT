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
const nc = readFileSync("lib/notification-center.ts", "utf8")
ok(nc.includes("connection_request"), "routes connection_request")
ok(nc.includes("post_like"), "routes post_like")
ok(nc.includes("ghc:open-connection-inbox"), "opens connection inbox")
ok(nc.includes("setTimeout") && nc.includes("open-connection-inbox"), "delayed inbox open")
ok(nc.includes('action: link.section === "comments" ? "comment"'), "comment opens sheet")
ok(!nc.includes("section: \"connection_requests\",\n            intents:"), "does not force profile for requests")

const bell = readFileSync("components/ghc/notification-bell.tsx", "utf8")
ok(bell.includes("connection_request") && bell.includes("friend_request"), "maps connection to friend_request")
ok(bell.includes("entityType === \"post\""), "postId from entity")

const types = readFileSync("lib/notifications.ts", "utf8")
ok(types.includes("connection_request"), "type connection_request")
ok(types.includes("post_like"), "type post_like")

if (failed) {
  console.log(`\nNOTIF DEEPLINK: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nNOTIF DEEPLINK: all checks passed")
