#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const route = readFileSync("app/api/social/posts/[id]/curation/route.ts", "utf8")
const card = readFileSync("components/ghc/enhanced-post-card.tsx", "utf8")
const checks = [
  ["atomic RPC must explicitly confirm ok=true", /data\?\.ok === true/.test(route)],
  ["choice must be a valid server-returned choice", /isCurationChoice\(rpcChoice\)/.test(route) && /const finalChoice: CurationChoice = rpcChoice/.test(route)],
  ["upvote and downvote counts must be non-negative safe integers", /Number\.isSafeInteger\(data\?\.upvoteCount\)/.test(route) && /Number\.isSafeInteger\(data\?\.downvoteCount\)/.test(route)],
  ["reward decision must be explicitly confirmed", /data\?\.reward\?\.ok === true/.test(route) && /typeof data\?\.reward\?\.credited === "boolean"/.test(route)],
  ["GHPV write must be explicitly confirmed", /data\?\.ghpv\?\.ok === true/.test(route)],
  ["incomplete RPC receipt fails closed with 503", /CURATION_COMMIT_UNCONFIRMED/.test(route) && /status: 503/.test(route)],
  ["server counts are never fabricated as zero on success", /upvoteCount: data\.upvoteCount,/.test(route) && /downvoteCount: data\.downvoteCount,/.test(route) && !/upvoteCount: data\.upvoteCount \?\? 0/.test(route)],
  ["mounted cards reconcile server-backed curation snapshots", /Feed\/profile caches can refresh a mounted card in place/.test(card) && /setCurationChoice\(seedChoice\)/.test(card)],
]
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`)
  assert.ok(passed, label)
}
console.log(`Phase 2 curation commit receipt: ${checks.length}/${checks.length} passed.`)
