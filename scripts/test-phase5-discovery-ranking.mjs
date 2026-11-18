import assert from "node:assert/strict"
import { filterDiscoveryPool, rankDiscoveryCandidates, scoreDiscoveryCandidate } from "../lib/discovery-ranking.ts"

const now = Date.now()
const candidates = [
  { id: "b", name: "Beta", interests: ["Climate", "Design"], lastActiveAt: now - 2_000, photo: "/beta.jpg" },
  { id: "a", name: "Alpha", interests: ["climate"], lastActiveAt: now - 2_000, photo: "/alpha.jpg" },
  { id: "a", name: "Alpha duplicate", interests: ["climate"] },
  { id: "blocked", name: "Blocked", interests: ["climate"] },
  { id: "matched", name: "Matched", interests: ["climate"] },
  { id: "self", name: "Self", interests: ["climate"] },
]
const before = JSON.stringify(candidates)
const context = {
  selfId: "self",
  interests: ["CLIMATE", "design"],
  blockedIds: ["blocked"],
  matchIds: ["matched"],
}
const ranked = rankDiscoveryCandidates(candidates, context)
assert.deepEqual(ranked.map((c) => c.id), ["b", "a"])
assert.equal(new Set(ranked.map((c) => c.id)).size, ranked.length)
assert.equal(JSON.stringify(candidates), before, "ranking must not mutate caller-owned records")
assert.equal(filterDiscoveryPool(candidates, context).some((c) => c.id === "blocked"), false)
assert.equal(scoreDiscoveryCandidate(candidates[0], context).score > 0, true)
assert.equal(ranked[1]._discoveryReasons?.includes("Shared interest: climate"), true)
console.log("Phase 5 discovery ranking runtime tests: PASS")
