import assert from "node:assert/strict"
import {
  compareFeedOrderDesc,
  containsAnyWholeTerm,
  containsWholeInterest,
  extractHashtags,
  isStrictlyOlderFeedCursor,
  matchPostInterests,
  normalizeInterest,
} from "../lib/feed/phase5-feed-primitives.ts"

assert.deepEqual(extractHashtags("#Climate #Ìfẹ́ #Climate #التعليم"), ["climate", "ìfẹ́", "التعليم"])
assert.equal(normalizeInterest("#Climate_Change"), "climate change")
assert.equal(containsWholeInterest("Art helps communities", "art"), true)
assert.equal(containsWholeInterest("A party in town", "art"), false, "whole-token matching must not award substring false positives")
assert.equal(containsAnyWholeTerm("Build a network with peers", ["work", "career"]), false, "intent matching must not match work inside network")
assert.equal(containsAnyWholeTerm("We updated the community", ["date", "community"]), true)
assert.deepEqual(matchPostInterests("A post about #Ìfẹ́ and art", undefined, ["Ìfẹ́", "art", "party", "art"], 3), ["ìfẹ́", "art"])
assert.deepEqual(matchPostInterests("#climate_change", undefined, ["climate change"], 3), ["climate change"])
assert.deepEqual(matchPostInterests("climate, design and art", undefined, ["climate", "design", "art", "music"], 2), ["climate", "design"], "interest boosts must be capped")

assert.equal(compareFeedOrderDesc({ createdAt: 20, id: "a" }, { createdAt: 20, id: "z" }) > 0, true)
assert.equal(compareFeedOrderDesc({ createdAt: 10, id: "z" }, { createdAt: 20, id: "a" }) > 0, true)
assert.equal(isStrictlyOlderFeedCursor({ before: 9, beforeId: "z" }, { before: 10, beforeId: "a" }), true)
assert.equal(isStrictlyOlderFeedCursor({ before: 10, beforeId: "a" }, { before: 10, beforeId: "z" }), true)
assert.equal(isStrictlyOlderFeedCursor({ before: 11, beforeId: "a" }, { before: 10, beforeId: "z" }), false)
assert.equal(isStrictlyOlderFeedCursor({ before: 10, beforeId: "z" }, { before: 10, beforeId: "z" }), false)

console.log("Phase 5 feed-quality runtime tests: PASS (Unicode topics, whole-interest matching, bounded relevance, deterministic order, monotonic cursors)")
