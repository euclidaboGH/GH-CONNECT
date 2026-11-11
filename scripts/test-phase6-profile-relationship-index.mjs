import assert from "node:assert/strict"
import { buildProfileRelationshipIndex, createProfileRelationshipIndexCache, uniqueProfileIds } from "../lib/domains/profile-relationship-index.ts"

const following = ["u1", "u1", " u2 ", ""]
const matches = [{ userId: "u3" }, { userId: "u3" }]
let sources = { following, matches, blocked: ["u4"] }
let reads = 0
const getIndex = createProfileRelationshipIndexCache(() => { reads += 1; return sources })
const first = getIndex()
assert.equal(first.following.size, 2, "duplicate and whitespace-only IDs are normalized")
assert.equal(first.following.has("u2"), true)
assert.equal(first.matches.size, 1, "duplicate match identities are collapsed")
assert.equal(first.blocked.has("u4"), true)
assert.equal(getIndex().following, first.following, "unchanged canonical arrays reuse the prepared index")
assert.equal(reads, 2, "source getters are checked but sets are not rebuilt")

sources = { ...sources, blocked: ["u5"] }
const second = getIndex()
assert.notEqual(second.blocked, first.blocked, "replacing a canonical array invalidates its derived index")
assert.equal(second.blocked.has("u4"), false)
assert.equal(second.blocked.has("u5"), true)
assert.equal(second.following, first.following, "unchanged relationship sets are reused independently")

assert.deepEqual(uniqueProfileIds(["u1", "u1", " u2 ", "", null, 4, "u2"]), ["u1", "u2"])
const secondIdentityCache = createProfileRelationshipIndexCache(() => ({ following: ["other-account"] }))
assert.equal(secondIdentityCache().following.has("other-account"), true, "separate domain instances keep account indexes isolated")
assert.equal(secondIdentityCache().following.has("u1"), false, "one identity cannot inherit another identity relationship IDs")

const blockedIndex = buildProfileRelationshipIndex({ blocked: ["unsafe-user"], following: ["unsafe-user"] })
assert.equal(blockedIndex.blocked.has("unsafe-user"), true, "block state remains independently indexed for block-first domain policy")

const empty = buildProfileRelationshipIndex({})
assert.equal(empty.following.size, 0)
assert.equal(empty.incomingRequests.size, 0)
console.log("PASS — Phase 6 relationship index runtime contract (16 assertions)")
