#!/usr/bin/env node
import assert from 'node:assert/strict'
import { normalizeEventItem, normalizeResourceItem, buildCommunityParticipationHub } from '../lib/domains/adapters/community-participation-hub.ts'
import { getGovernanceDurability, governanceDurabilityLabel } from '../lib/domains/adapters/community-governance-store.ts'

const legacyEvent = { title: 'Community welcome', startsAt: 1_900_000_000_000, location: 'Online' }
const first = normalizeEventItem(legacyEvent, 2)
const second = normalizeEventItem(legacyEvent, 2)
assert.equal(first.id, second.id, 'legacy event fallback identity must be deterministic')
assert.equal(first.title, 'Community welcome')
assert.equal(normalizeEventItem({ id: 'canonical-event-1' }, 0).id, 'canonical-event-1')
assert.equal(normalizeEventItem({ startsAt: '2030-01-01T12:00:00.000Z' }, 0).startsAt, Date.parse('2030-01-01T12:00:00.000Z'))
assert.equal(normalizeEventItem({ startsAt: 1_900_000_000 }, 0).startsAt, 1_900_000_000_000)
assert.equal(normalizeEventItem({ startsAt: 'not-a-date' }, 0).startsAt, null)
assert.equal(normalizeEventItem(null, 0).title, 'Community event')

assert.equal(normalizeResourceItem({ url: 'javascript:alert(1)' }, 0).url, undefined)
assert.equal(normalizeResourceItem({ url: 'data:text/html,unsafe' }, 0).url, undefined)
assert.equal(normalizeResourceItem({ url: '//evil.example/path' }, 0).url, undefined)
assert.equal(normalizeResourceItem({ url: 'https://example.com/guide' }, 0).url, 'https://example.com/guide')
assert.equal(normalizeResourceItem({ url: 'https://user:secret@example.com/guide' }, 0).url, undefined)
assert.equal(normalizeResourceItem({ url: '/api/community/resources/1' }, 0).url, '/api/community/resources/1')
assert.equal(normalizeResourceItem(null, 0).order, 0)
assert.equal(normalizeResourceItem({ order: Number.POSITIVE_INFINITY }, 4).order, 4)

const hub = buildCommunityParticipationHub({ communityId: 'community-1', events: [legacyEvent, legacyEvent] })
assert.equal(hub.upcomingEvents.length, 2)
assert.notEqual(hub.upcomingEvents[0].id, hub.upcomingEvents[1].id, 'array-position fallback keeps duplicate legacy rows distinct')

const original = process.env.GHC_GOVERNANCE_SERVER
process.env.GHC_GOVERNANCE_SERVER = '1'
assert.equal(getGovernanceDurability(), 'session', 'feature flag is not durable-write proof')
assert.match(governanceDurabilityLabel(), /Session-only/)
if (original === undefined) delete process.env.GHC_GOVERNANCE_SERVER
else process.env.GHC_GOVERNANCE_SERVER = original

console.log('Priority 7 Community normalization/runtime contract: 18/18 passed')
