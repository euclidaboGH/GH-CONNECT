import assert from "node:assert/strict"
import { parseProfileIdentitySnapshot } from "../lib/domains/profile-identity-snapshot.ts"

const follows = { ok: true, durable: true, followersCount: 12, followingCount: 8 }
const reputation = { ok: true, durable: true, level: 3, levelName: "Sapling", totalPoints: 240, progressRatio: 0.4 }
const achievements = { ok: true, durable: true, achievements: [{ id: "first_post" }] }
const parsed = parseProfileIdentitySnapshot(follows, reputation, achievements)
assert.deepEqual(parsed, { followers: 12, following: 8, level: 3, levelName: "Sapling", points: 240, progress: 0.4, achievements: 1, durable: true })
assert.equal(parseProfileIdentitySnapshot({ ...follows, durable: false }, reputation, achievements).durable, false)
assert.equal(parseProfileIdentitySnapshot(follows, { ...reputation, durable: false }, achievements).durable, false)
assert.equal(parseProfileIdentitySnapshot(follows, reputation, { ...achievements, durable: false }).durable, false)
for (const [label, args] of [
  ["failed follows", [{ ok: false, error: "DB_UNAVAILABLE" }, reputation, achievements]],
  ["failed reputation", [follows, { ok: false, error: "REPUTATION_UNAVAILABLE" }, achievements]],
  ["failed achievements", [follows, reputation, { ok: false, error: "ACHIEVEMENTS_LOAD_FAILED" }]],
  ["missing achievement rows", [follows, reputation, { ok: true, durable: true }]],
  ["invalid progress", [follows, { ...reputation, progressRatio: 1.5 }, achievements]],
  ["invalid negative counts", [{ ...follows, followersCount: -1 }, reputation, achievements]],
  ["invalid reputation level", [follows, { ...reputation, level: 0 }, achievements]],
]) assert.throws(() => parseProfileIdentitySnapshot(...args), undefined, label)
assert.equal(parseProfileIdentitySnapshot({ ...follows, durable: undefined }, reputation, achievements).durable, false)
console.log("PASS — Phase 4 profile identity snapshot contract (13 assertions)")
