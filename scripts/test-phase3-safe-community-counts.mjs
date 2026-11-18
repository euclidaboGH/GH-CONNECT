import assert from 'node:assert/strict'
import { safeCommunityCount, safeCommunityCountTotal } from '../lib/active-upgrades/community.ts'
assert.equal(safeCommunityCount(0), 0)
assert.equal(safeCommunityCount(12), 12)
assert.equal(safeCommunityCount('12'), 12)
assert.equal(safeCommunityCount(-1), 0)
assert.equal(safeCommunityCount(1.5), 0)
assert.equal(safeCommunityCount(Number.NaN), 0)
assert.equal(safeCommunityCount(Number.MAX_SAFE_INTEGER + 1), 0)
assert.equal(safeCommunityCountTotal([Number.MAX_SAFE_INTEGER, 20]), Number.MAX_SAFE_INTEGER)
assert.equal(safeCommunityCountTotal([1, 2, 3]), 6)
console.log('Phase 3 safe community count runtime: 9/9 assertions passed')
