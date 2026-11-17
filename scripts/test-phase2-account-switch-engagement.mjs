import assert from "node:assert/strict"
import { buildSocialRequestIdentityKey, isSocialRequestIdentityCurrent } from "../lib/social/request-identity.ts"

const alice = { userId: "alice-gh-id", piUserId: "alice-pi", authState: "authenticated", accessToken: "secret-a" }
const aliceRefresh = { ...alice, accessToken: "secret-b" }
const bob = { userId: "bob-gh-id", piUserId: "bob-pi", authState: "authenticated", accessToken: "secret-c" }
const anonymous = { userId: "current-user", piUserId: null, authState: "anonymous" }
const aliceKey = buildSocialRequestIdentityKey(alice)

assert.equal(isSocialRequestIdentityCurrent(aliceKey, alice), true, "same account response remains valid")
assert.equal(isSocialRequestIdentityCurrent(aliceKey, aliceRefresh), true, "token refresh does not leak token into key or invalidate same-account data")
assert.equal(isSocialRequestIdentityCurrent(aliceKey, bob), false, "old account response is rejected after account switch")
assert.equal(isSocialRequestIdentityCurrent(aliceKey, anonymous), false, "old account response is rejected after logout")
assert.notEqual(buildSocialRequestIdentityKey(alice), buildSocialRequestIdentityKey(bob), "GET coalescing keys differ across accounts")
assert.equal(aliceKey.includes("secret"), false, "identity key never contains access-token material")
assert.equal(isSocialRequestIdentityCurrent("", alice), false, "empty request snapshots fail closed")
console.log("Phase 2 account-switch runtime contract: 7/7 checks passed")
