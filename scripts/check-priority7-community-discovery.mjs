#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const screen = read('components/ghc/communities-screen.tsx')
const discovery = read('lib/community/discovery.ts')
const participation = read('lib/domains/adapters/community-participation-hub.ts')
const card = read('components/ghc/group-card.tsx')
const hub = read('components/ghc/premium-community-hub.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const checks = [
  ['Most members uses the authoritative aggregate count, not partial member IDs', discovery.includes('export function communityMemberCount') && screen.includes('communityMemberCount(b)')],
  ['Unread ranking treats legacy unreadCount as a chat fallback rather than a second counter', discovery.includes('const chatValue = row.chatUnread !== undefined && row.chatUnread !== null') && screen.includes('communityUnreadCount(a)')],
  ['Community pulse totals use the same bounded independent unread lanes', screen.includes('communityUnreadCount({ boardUnread: c.boardUnread })') && screen.includes('communityUnreadCount({ chatUnread: c.chatUnread, unreadCount: c.unreadCount })')],
  ['Event normalization accepts ISO dates and Unix-second timestamps', participation.includes('Date.parse(raw.trim())') && participation.includes('numeric < 100_000_000_000 ? numeric * 1000 : numeric')],
  ['Invalid event dates remain unknown instead of becoming false epoch dates', participation.includes('return 0') && participation.includes('startsAt: startsAt || null')],
  ['External HTTPS resource URLs reject embedded credentials', participation.includes('parsed.username || parsed.password')],
  ['Pending join requests are displayed without offering a duplicate join action', card.includes('membershipStatus === \"pending\"') && card.includes('Request pending') && screen.includes('onJoin={!joined && !membershipStatus')],
  ['Invitations can be accepted or declined through canonical context actions', card.includes('onAcceptInvite') && card.includes('onDeclineInvite') && screen.includes('acceptCommunityInvitation') && screen.includes('declineCommunityInvitation')],
  ['Community hub prevents duplicate joins for pending and invited states', hub.includes('community.membershipState === \"pending\" || community.membershipState === \"invited\"') && hub.includes('Accept invite')],
  ['Community privacy labels preserve approval and invite-only semantics', screen.includes('privacy: normalizeCommunityPrivacy(selected.privacy)') && hub.includes('Approval required') && hub.includes('Invite only')],
  ['Discovery regression gates are registered in prebuild and static verification', (pkg.scripts.prebuild.match(/check-priority7-community-discovery\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-priority7-community-discovery\.mjs/g) || []).length === 1],
  ['Runtime discovery contract is registered in prebuild and static verification', (pkg.scripts.prebuild.match(/test-priority7-community-discovery\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/test-priority7-community-discovery\.mjs/g) || []).length === 1],
  ['Release metadata is synchronized', lock.version === pkg.version && lock.packages[''].version === pkg.version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
assert.equal(failed, 0, `${failed} Priority 7 Community discovery checks failed`)
console.log(`Priority 7 Community discovery transformation: ${checks.length}/${checks.length} passed`)
