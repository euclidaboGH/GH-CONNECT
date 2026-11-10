#!/usr/bin/env node
/** Phase 6 Communities & Discovery source contracts. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const integrity = read('lib/server/community/community-integrity.ts')
const joinStatus = read('lib/community/join-status.ts')
const candidates = read('lib/discovery/candidate-filter.ts')
const joinRoute = read('app/api/communities/[id]/join/route.ts')
const listRoute = read('app/api/communities/route.ts')
const discovery = read('lib/community/discovery.ts')
const governance = read('lib/server/community/governance-store.ts')
const people = read('app/api/social/people/discover/route.ts')
const screen = read('components/ghc/communities-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')

test('community integrity sanitizes community ids', /sanitizeCommunityId/.test(integrity))
test('community integrity requires durable store in production for membership writes', /COMMUNITY_DURABILITY_UNAVAILABLE/.test(integrity))
test('join status mapping is honest for pending and active', /pendingApproval/.test(integrity) && /Request pending/.test(integrity))
test('join CTA distinguishes Join vs Request to join vs invite-only', /Request to join/.test(joinStatus) && /Invite only/.test(joinStatus))
test('join API returns isMember and pendingApproval', /isMember/.test(joinRoute) && /pendingApproval/.test(joinRoute) && /mapJoinStatus/.test(joinRoute))
test('join API uses sanitized community id', /sanitizeCommunityId/.test(joinRoute))
test('community list enriches viewerIsMember from memberships RPC', /viewerIsMember/.test(listRoute) && /gh_community_list_memberships/.test(listRoute))
test('privacy filters support public request invite private', /normalizeCommunityPrivacy/.test(discovery))
test('moderation requires owner admin or moderator role', /requireCommunityModerator/.test(governance))
test('people discover requires auth and rate limits', /AUTH_REQUIRED/.test(people) && /people-discover/.test(people))
test('discovery candidate filter excludes self block and mute', /filterDiscoveryCandidates/.test(candidates) && /idListIncludes/.test(candidates))
test('communities UI uses resolveJoinCta for honest labels', /resolveJoinCta/.test(screen))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('phase 6 checker is registered in prebuild', Boolean(pkg.scripts?.['prebuild:checks']?.includes('check-phase6-communities-discovery.mjs')))
test('phase 6 programme doc exists', existsSync(join(root, 'docs/PHASE-6-COMMUNITIES-DISCOVERY-2026-11-08.md')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 6 communities & discovery: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
