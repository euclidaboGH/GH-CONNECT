import assert from 'node:assert/strict'
import { canAppearInMatchInbox, blockedPeerIdsForViewer, encodePostgrestInList, readMatchInboxPrivacy } from '../lib/server/social/match-inbox-policy.ts'
let checks = 0
const check = (value, label) => { assert.ok(value, label); checks++ }
const everyone = readMatchInboxPrivacy({ privacySettings: { profileVisibility: 'everyone', whoCanDiscover: 'everyone' } })
check(canAppearInMatchInbox(everyone, false), 'everyone profile can appear in one-sided inbox')
check(!canAppearInMatchInbox(readMatchInboxPrivacy({ privacy: { profileVisibility: 'hidden' } }), true), 'hidden profile never appears')
check(!canAppearInMatchInbox(readMatchInboxPrivacy({ privacySettings: { whoCanDiscover: 'no-one' } }), true), 'discovery opt-out never appears')
check(!canAppearInMatchInbox(readMatchInboxPrivacy({ privacySettings: { whoCanDiscover: 'matches-only' } }), false), 'matches-only hides one-sided interest')
check(canAppearInMatchInbox(readMatchInboxPrivacy({ privacySettings: { whoCanDiscover: 'matches-only' } }), true), 'matches-only allows reciprocal match')
check(!canAppearInMatchInbox(readMatchInboxPrivacy({ privacySettings: { profileVisibility: 'matches-only' } }), false), 'matches-only profile hides one-sided interest')
check(!canAppearInMatchInbox({ profileVisibility: 'unrecognized' }, true), 'unknown privacy values fail closed')
const blocked = blockedPeerIdsForViewer('viewer', [
  { blocker_id: 'viewer', blocked_id: 'blocked_by_viewer' },
  { blocker_id: 'blocked_viewer', blocked_id: 'viewer' },
  { blocker_id: 'other', blocked_id: 'third' },
])
check(blocked.has('blocked_by_viewer') && blocked.has('blocked_viewer') && !blocked.has('third'), 'blocks in either direction are excluded')
check(encodePostgrestInList(['abc', 'x,y', 'q"z']).startsWith('in.('), 'PostgREST in-list encoded')
check(encodePostgrestInList(['abc']).includes('"abc"'), 'PostgREST in-list quotes string identifiers')
console.log(`Run #284 match inbox privacy tests: ${checks}/${checks} PASS`)
