import assert from "node:assert/strict"
import {
  communityAccountStorageKey,
  parseCommunityBoardCache,
  parseCommunityJoinedIds,
} from "../lib/community/account-scoped-cache.ts"

const aliceJoined = communityAccountStorageKey("ghc.community.joinedIds", "alice")
const bobJoined = communityAccountStorageKey("ghc.community.joinedIds", "bob")
assert.ok(aliceJoined && bobJoined && aliceJoined !== bobJoined, "different accounts must receive different membership cache keys")
assert.equal(communityAccountStorageKey("ghc.community.joinedIds", "bad\u0000id"), null, "control characters must be rejected")
assert.equal(communityAccountStorageKey("ghc.community.joinedIds", "x".repeat(257)), null, "oversized identity must be rejected")
assert.equal(communityAccountStorageKey("ghc.community.unknown", "alice"), null, "unknown storage namespaces must be rejected")
assert.deepEqual(parseCommunityJoinedIds(JSON.stringify(["community-a", "community-a", "", 7, "bad\u0000id", "community-b"])), ["community-a", "community-b"], "membership hints must be bounded, safe and deduplicated")
assert.deepEqual(parseCommunityJoinedIds("not-json"), [], "invalid JSON must fail closed")
assert.deepEqual(parseCommunityJoinedIds(JSON.stringify({ id: "community-a" })), [], "non-array membership cache must fail closed")
assert.equal(parseCommunityJoinedIds(JSON.stringify(Array.from({ length: 5_100 }, (_, index) => `community-${index}`))).length, 5_000, "membership cache must enforce its hard entry cap")
assert.deepEqual(parseCommunityJoinedIds("x".repeat(512_001)), [], "oversized membership cache input must fail closed")
const board = parseCommunityBoardCache(JSON.stringify({
  "community-a": [{ id: "post-1" }, null, "invalid"],
  "bad\u0000community": [{ id: "post-2" }],
  "community-b": "invalid",
}))
assert.deepEqual(board, { "community-a": [{ id: "post-1" }] }, "board cache must discard malformed community/post rows")
assert.deepEqual(parseCommunityBoardCache("invalid"), {}, "invalid board cache must fail closed")
const cappedBoard = parseCommunityBoardCache(JSON.stringify({ "community-a": Array.from({ length: 120 }, (_, index) => ({ id: `post-${index}` })) }))
assert.equal(cappedBoard["community-a"].length, 100, "board cache must cap posts per community")
const manyCommunities = Object.fromEntries(Array.from({ length: 520 }, (_, index) => [`community-${index}`, []]))
assert.equal(Object.keys(parseCommunityBoardCache(JSON.stringify(manyCommunities))).length, 500, "board cache must cap community entries")
assert.deepEqual(parseCommunityBoardCache("x".repeat(2_000_001)), {}, "oversized board cache input must fail closed")
console.log("phase7 community cache isolation: 13/13 passed")
