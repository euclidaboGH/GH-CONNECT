#!/usr/bin/env node
/** RUN376: runtime checks for GHPV reviewer independence and anti-whale weighting. */
import assert from 'node:assert/strict'
import { applyAntiWhaleCap, computeSettlement } from '../lib/server/ghpv/settlement.ts'

const whalePool = [
  { reviewerId: 'whale', choice: 'upvote', weight: 1000 },
  ...Array.from({ length: 9 }, (_, i) => ({ reviewerId: `reviewer-${i}`, choice: i % 2 ? 'downvote' : 'upvote', weight: 1 })),
]
const capped = applyAntiWhaleCap(whalePool)
const originalTotal = whalePool.reduce((sum, vote) => sum + vote.weight, 0)
const cappedTotal = capped.reduce((sum, vote) => sum + vote.weight, 0)
const maxShare = Math.max(...capped.map((vote) => vote.weight)) / cappedTotal
assert.ok(Math.abs(cappedTotal - originalTotal) < 1e-8, 'anti-whale redistribution must preserve total weight')
assert.ok(maxShare <= 0.120000001, `largest reviewer share must be at most 12%; got ${maxShare}`)

console.log('PASS whale influence is capped at 12% after redistribution')

const multiWhalePool = [
  { reviewerId: 'whale-a', choice: 'upvote', weight: 500 },
  { reviewerId: 'whale-b', choice: 'downvote', weight: 400 },
  { reviewerId: 'whale-c', choice: 'upvote', weight: 300 },
  ...Array.from({ length: 12 }, (_, i) => ({ reviewerId: `small-${i}`, choice: 'upvote', weight: 1 })),
]
const multiWhaleCapped = applyAntiWhaleCap(multiWhalePool)
const multiWhaleTotal = multiWhaleCapped.reduce((sum, vote) => sum + vote.weight, 0)
assert.ok(Math.abs(multiWhaleTotal - 1212) < 1e-7, 'multi-whale redistribution must conserve total weight')
assert.ok(Math.max(...multiWhaleCapped.map((vote) => vote.weight)) / multiWhaleTotal <= 0.120000001)
console.log('PASS multiple whales are capped after iterative redistribution while conserving total influence')

const smallPool = [
  { reviewerId: 'a', choice: 'upvote', weight: 100 },
  { reviewerId: 'b', choice: 'downvote', weight: 1 },
  { reviewerId: 'c', choice: 'upvote', weight: 1 },
]
const smallCapped = applyAntiWhaleCap(smallPool)
const smallTotal = smallCapped.reduce((sum, vote) => sum + vote.weight, 0)
assert.ok(Math.max(...smallCapped.map((vote) => vote.weight)) / smallTotal <= 1 / 3 + 1e-8)
assert.ok(Math.abs(smallTotal - 102) < 1e-8, 'small-panel redistribution must preserve total weight')
console.log('PASS small panels use a feasible 1/N cap rather than an impossible fixed 12% and preserve total weight')

const duplicate = computeSettlement({
  contentId: 'post-1', settlementEpoch: '2026-W47', judgmentMode: 'factual', minVoters: 3,
  votes: [
    { reviewerId: 'same-user', choice: 'upvote', weight: 10 },
    { reviewerId: 'same-user', choice: 'downvote', weight: 10 },
    { reviewerId: 'other-1', choice: 'upvote', weight: 5 },
    { reviewerId: 'other-2', choice: 'upvote', weight: 5 },
  ],
})
assert.equal(duplicate.independentVoters, 2)
assert.equal(duplicate.status, 'UNRESOLVED')
assert.equal(duplicate.reviewerEffects.some((effect) => effect.reviewerId === 'same-user'), false)
console.log('PASS duplicate reviewer rows are excluded and cannot create false quorum')

const invalid = applyAntiWhaleCap([
  { reviewerId: 'bad', choice: 'upvote', weight: Number.NaN },
  { reviewerId: 'good', choice: 'upvote', weight: 2 },
])
assert.equal(invalid.length, 1)
assert.equal(invalid[0].reviewerId, 'good')
console.log('PASS malformed reviewer weights are rejected')
console.log('RUN376 GHPV runtime checks: 5/5 passed')
