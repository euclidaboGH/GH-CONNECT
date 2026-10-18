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
const start = ctx.indexOf("const reactToPost = async")
const end = ctx.indexOf("const likePost = async")
const body = ctx.slice(start, end)
ok(body.includes("socialToggleReaction"), "uses socialToggleReaction")
ok(body.includes("Server-first") || body.includes("server-first") || body.includes("Server-first"), "server-first comment")
ok(body.indexOf("socialToggleReaction") < body.indexOf("setState"), "API before setState")
ok(body.includes("durable === false"), "rejects non-durable")
ok(!body.includes("/* local-only — keep optimistic"), "no keep-optimistic on network fail")
ok(!body.includes("Roll back optimistic"), "no optimistic-rollback path (server-first)")

const card = readFileSync("components/ghc/enhanced-post-card.tsx", "utf8")
ok(card.includes("res.durable === false"), "curation requires durable")

const story = readFileSync("components/ghc/profile-story-section.tsx", "utf8")
ok(story.includes("result.durable === false"), "story reaction requires durable")

if (failed) {
  console.log(`\nREACTION SERVER-FIRST: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nREACTION SERVER-FIRST: all checks passed")
