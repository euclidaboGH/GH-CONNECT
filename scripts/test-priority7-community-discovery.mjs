#!/usr/bin/env node
import assert from 'node:assert/strict'
import { communityMemberCount, communityUnreadCount, normalizeCommunityPrivacy } from '../lib/community/discovery.ts'

// Remote directory rows often contain only the viewer and owner IDs; the explicit
// aggregate memberCount remains the correct source for the “Most members” sort.
assert.equal(communityMemberCount({ memberCount: 842, members: ['owner', 'viewer'] }), 842)
assert.equal(communityMemberCount({ memberCount: 0, members: ['owner'] }), 0)
assert.equal(communityMemberCount({ members: ['one', 'two', 'three'] }), 3)
assert.equal(communityMemberCount({ memberCount: Number.NaN, members: ['one'] }), 1)
assert.equal(communityMemberCount({ memberCount: -4, members: ['one'] }), 1)

// `unreadCount` is a legacy chat fallback, not an additional independent lane.
assert.equal(communityUnreadCount({ boardUnread: 3, chatUnread: 5, unreadCount: 5 }), 8)
assert.equal(communityUnreadCount({ boardUnread: 3, chatUnread: 0, unreadCount: 5 }), 3)
assert.equal(communityUnreadCount({ boardUnread: 2, unreadCount: 4 }), 6)
assert.equal(communityUnreadCount({ boardUnread: -2, chatUnread: Number.NaN }), 0)

// Access modes remain distinct for approval and invite-only communities.
assert.equal(normalizeCommunityPrivacy('approval'), 'request')
assert.equal(normalizeCommunityPrivacy('invite-only'), 'invite')

console.log('Priority 7 Community discovery runtime contract: 11/11 passed')
