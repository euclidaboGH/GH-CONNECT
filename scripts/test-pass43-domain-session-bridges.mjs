import assert from 'node:assert/strict'
import {
  mapSessionFeedPosts,
  mapSessionDiscoveryCandidates,
  summarizeSessionConnections,
} from '../lib/domains/adapters/session-domain-mappers.ts'

const posts = mapSessionFeedPosts([
  { id: 'p1', authorId: 'u1', authorName: 'A', content: 'hello', createdAt: 1_793_492_800_000, likes: 0, comments: [] },
  { id: 'draft', isDraft: true },
  { id: 'scheduled', isScheduled: true },
  { id: '', content: 'invalid' },
  { id: 'p2', createdAt: '2026-10-31T12:00:00.000Z', comments: [{}] },
])
assert.equal(posts.length, 2)
assert.equal(posts[0].createdAt, '2026-11-01T00:26:40.000Z')
assert.equal(posts[0].likes, 0)
assert.equal(posts[1].commentCount, 1)
assert.equal(posts[1].authorName, 'Member')

const productionCandidates = mapSessionDiscoveryCandidates([
  { id: 'server-1', name: 'Server', isSample: false, interests: ['design'] },
  { id: 'sample-1', name: 'Sample', isSample: true },
  { id: 'unknown-1', name: 'Unverified' },
  { id: '', name: 'No ID', isSample: false },
], false)
assert.equal(productionCandidates.length, 1)
assert.equal(productionCandidates[0].displayName, 'Server')
assert.deepEqual(productionCandidates[0].interests, ['design'])
assert.equal(mapSessionDiscoveryCandidates([{ id: 'sample-1', isSample: true }], true).length, 1)

const summary = summarizeSessionConnections({
  friends: ['f1', 'f2'],
  following: ['f1'],
  followers: ['f3', 'f4', 'f5'],
  currentUserId: 'me',
  friendRequests: [
    { fromUserId: 'other', toUserId: 'me' },
    { fromUserId: 'me', toUserId: 'other' },
    { fromUserId: 'other-2' },
    { fromUserId: 'me' },
  ],
})
assert.deepEqual(summary, { friendsCount: 2, followingCount: 1, followersCount: 3, pendingRequestsCount: 2 })
assert.equal(summarizeSessionConnections({ friends: [], following: [], followers: [], friendRequests: [{ fromUserId: 'other' }], currentUserId: '' }).pendingRequestsCount, 0)
console.log('PASS Pass 43 domain session bridge runtime tests: 12 assertions')
