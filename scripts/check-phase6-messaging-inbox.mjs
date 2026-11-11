#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
let fail = 0
const ok = (label, cond) => {
  if (cond) console.log(`PASS ${label}`)
  else {
    console.log(`FAIL ${label}`)
    fail++
  }
}
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")

const msg = read("components/ghc/message-screen.tsx")
ok("inbox peer enrichment map", msg.includes("peerIndex") && msg.includes("indexPeer"))
ok("enrich from candidates/friends/matches", msg.includes("ghc.candidates") && msg.includes("ghc.friends") && msg.includes("ghc.matches"))
ok("candidates wired from useGHC", msg.includes("candidates") && msg.includes("useGHC"))
ok("inbox pull-to-refresh", msg.includes("inboxRefreshing") && msg.includes("Refreshing inbox"))
ok("messages soft-refresh reloads list", msg.includes("refreshConversations") || msg.includes("loadConversations"))

const item = read("components/ghc/message-components.tsx")
ok("displayName not circular", item.includes("conversation.groupName || conversation.participantName") && !item.includes("? displayName\n"))
ok("DM title uses displayName", item.includes(": displayName}"))
ok("LazyImage on conversation avatar", item.includes("LazyImage"))

console.log("")
console.log(`Phase 6 messaging inbox: ${8 - fail}/8 passed`)
process.exit(fail ? 1 : 0)
