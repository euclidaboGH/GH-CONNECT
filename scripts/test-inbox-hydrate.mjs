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
const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
ok(ctx.includes("socialFetchConnectionInbox"), "connection inbox fetch")
ok(ctx.includes("socialFetchFollows"), "follows rehydrate")
ok(ctx.includes("ghc:connection-inbox-updated"), "inbox updated event")
ok(ctx.includes("MIN_MS = 12_000") || ctx.includes("MIN_MS = 12000"), "faster focus revalidate")
ok(ctx.includes("candName") || ctx.includes("candidates"), "name enrichment path")

const app = readFileSync("components/ghc/app.tsx", "utf8")
ok(app.includes("ghc:connection-inbox-updated"), "badge listens inbox-updated")
ok(app.includes("ghc:social-mutation"), "badge listens social-mutation")

const inbox = readFileSync("components/ghc/connection-request-inbox.tsx", "utf8")
ok(inbox.includes("visibilitychange"), "inbox refreshes on visibility")
ok(inbox.includes("ghc:social-mutation"), "inbox refreshes on mutation")

if (failed) {
  console.log(`\nINBOX HYDRATE: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nINBOX HYDRATE: all checks passed")
