#!/usr/bin/env node
import assert from 'node:assert/strict'
import { parseEventRecord } from '../lib/domains/adapters/event-contract.ts'
import { eventsEmptyState } from '../lib/domains/contracts/events.ts'

const base = {
  id: 'event_123', organizerId: 'user_123', title: 'Community design meetup',
  description: 'A real community gathering.', startsAt: '2027-02-01T10:00:00Z',
  endsAt: '2027-02-01T12:00:00Z', timezone: 'Africa/Lagos', visibility: 'public',
  lifecycle: 'draft', isOnline: false, locationLabel: 'Jos, Plateau State',
  createdAt: '2027-01-01T10:00:00Z', updatedAt: '2027-01-01T10:00:00Z',
}

assert.equal(parseEventRecord(base).ok, true, 'accepts a valid draft event contract')
assert.equal(parseEventRecord({ ...base, endsAt: base.startsAt }).code, 'INVALID_DATE_RANGE')
assert.equal(parseEventRecord({ ...base, title: 'x'.repeat(121) }).code, 'INVALID_EVENT')
assert.equal(parseEventRecord({ ...base, isOnline: true, meetingUrl: 'javascript:alert(1)' }).code, 'INVALID_LOCATION')
assert.equal(parseEventRecord({ ...base, isOnline: false, locationLabel: '' }).code, 'INVALID_LOCATION')
assert.equal(parseEventRecord({ ...base, capacity: 0 }).code, 'INVALID_EVENT')
assert.equal(parseEventRecord({ ...base, capacity: 100001 }).code, 'INVALID_EVENT')
assert.equal(parseEventRecord(null).code, 'INVALID_EVENT')
assert.equal(parseEventRecord({ ...base, lifecycle: 'live' }).code, 'INVALID_EVENT')
assert.equal(parseEventRecord({ ...base, startsAt: '2027-02-01' }).code, 'INVALID_EVENT')
assert.equal(parseEventRecord({ ...base, timezone: 'Mars/Olympus' }).code, 'INVALID_EVENT')
assert.equal(parseEventRecord({ ...base, communityId: 'x'.repeat(129) }).code, 'INVALID_EVENT')
assert.match(eventsEmptyState().title, /coming soon/i)
assert.match(eventsEmptyState().description, /being fabricated/i)

const online = parseEventRecord({ ...base, isOnline: true, locationLabel: undefined, meetingUrl: 'https://meet.example.org/room/1' })
assert.equal(online.ok, true)
assert.equal(online.data.meetingUrl, 'https://meet.example.org/room/1')

console.log('Social Events contract: 15/15 checks passed')
