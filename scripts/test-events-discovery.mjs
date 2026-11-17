#!/usr/bin/env node
import assert from 'node:assert/strict'
import { parseEventsDiscoveryFilters, projectVisibleCommunityEvents } from '../lib/ecosystem/events-discovery.ts'

const now = Date.parse('2026-11-11T10:00:00.000Z')
const baseEvent = {
  id: 'event_001', community_id: 'community_public', title: 'GreenHaven Builders Meetup',
  description: 'A practical community gathering for builders.', starts_at: '2026-11-12T10:00:00.000Z',
  ends_at: '2026-11-12T12:00:00.000Z', status: 'scheduled', location: 'Jos, Plateau',
  virtual_link: 'https://meet.example.com/greenhaven', category: 'meeting', creator_id: 'must-not-leak',
}
const communities = [
  { id: 'community_public', name: 'Jos Builders', privacy: 'public', deleted_at: null },
  { id: 'community_private', name: 'Private Circle', privacy: 'private', deleted_at: null },
  { id: 'community_deleted', name: 'Deleted Circle', privacy: 'public', deleted_at: '2026-11-01T00:00:00.000Z' },
]
const parse = (query = '') => parseEventsDiscoveryFilters(new URLSearchParams(query))

assert.deepEqual(parse('').ok && parse('').value, { query: '', category: null, limit: 30, offset: 0 })
assert.equal(parse('limit=51').ok, false)
assert.equal(parse('offset=10001').ok, false)
assert.equal(parse('category=air').ok, false)
assert.equal(parse('q=%00').ok, false)

const filters = parse('limit=10&offset=0')
assert.equal(filters.ok, true)
const result = projectVisibleCommunityEvents({
  events: [
    baseEvent,
    { ...baseEvent, id: 'event_private', community_id: 'community_private', title: 'Private event' },
    { ...baseEvent, id: 'event_deleted', community_id: 'community_deleted' },
    { ...baseEvent, id: 'event_cancelled', status: 'cancelled' },
    { ...baseEvent, id: 'event_bad_date', ends_at: 'not-a-date' },
    { ...baseEvent, id: 'event_bad_link', virtual_link: 'javascript:alert(1)' },
  ],
  communities,
  memberships: [],
  rsvps: [{ event_id: 'event_001', status: 'going' }],
  filters: filters.value,
  now,
})
assert.equal(result.events.length, 2)
assert.deepEqual(result.events.map((event) => event.id), ['event_001', 'event_bad_link'])
assert.equal(result.events[0].viewerRsvpStatus, 'going')
assert.equal(result.events[0].virtualLink, 'https://meet.example.com/greenhaven')
assert.equal(result.events[1].virtualLink, null)
assert.equal('creatorId' in result.events[0], false)

const privateVisible = projectVisibleCommunityEvents({
  events: [{ ...baseEvent, id: 'event_private', community_id: 'community_private' }],
  communities,
  memberships: [{ community_id: 'community_private' }],
  rsvps: [],
  filters: filters.value,
  now,
})
assert.equal(privateVisible.events.length, 1)

const queryFiltered = projectVisibleCommunityEvents({
  events: [baseEvent], communities, memberships: [], rsvps: [],
  filters: { ...filters.value, query: 'not found' }, now,
})
assert.equal(queryFiltered.events.length, 0)

const ongoing = projectVisibleCommunityEvents({
  events: [{ ...baseEvent, id: 'event_ongoing', status: 'ongoing', starts_at: '2026-11-11T09:00:00.000Z', ends_at: '2026-11-11T11:00:00.000Z' }],
  communities, memberships: [], rsvps: [], filters: filters.value, now,
})
assert.equal(ongoing.events.length, 1)

console.log('Events discovery contract: 15/15 passed')
