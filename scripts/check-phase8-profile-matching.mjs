#!/usr/bin/env node
/** Phase 8 Profile & Matching source contracts. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const integrity = read('lib/server/social/relationship-integrity.ts')
const follows = read('app/api/social/follows/route.ts')
const signal = read('app/api/matching/signal/route.ts')
const clarity = read('lib/discovery/match-clarity.ts')
const conn = read('app/api/connections/request/route.ts')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')

test('relationship integrity rejects self targets', /error: "SELF"/.test(integrity))
test('relationship integrity rejects demo placeholder targets', /demo|INVALID_TARGET/.test(integrity))
test('humanized relationship errors cover self block and auth', /You cannot follow/.test(integrity) && /blocked/.test(integrity))
test('follow POST ignores client actor/follower ids', /void body\.followerId/.test(follows) && /void body\.actorId/.test(follows))
test('follow POST uses sanitizeTargetUserId and humanized errors', /sanitizeTargetUserId/.test(follows) && /humanizeRelationshipError/.test(follows))
test('follow is rate limited per actor', /follow:\$\{auth\.userId\}/.test(follows))
test('match signal actor is session user only', /p_from_user_id: auth\.userId/.test(signal))
test('match signal validates target and signal enum', /sanitizeTargetUserId/.test(signal) && /superlike/.test(signal))
test('match signal is rate limited', /match-signal:/.test(signal))
test('match clarity separates Interest from Connect', /Like shows interest/.test(clarity) && /Connect sends a real request/.test(clarity))
test('connection request emits social notification on durable write', /emitSocialNotification/.test(conn) && /connection/.test(conn))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('phase 8 checker is registered in prebuild', Boolean(pkg.scripts?.['prebuild:checks']?.includes('check-phase8-profile-matching.mjs')))
test('phase 8 programme doc exists', existsSync(join(root, 'docs/PHASE-8-PROFILE-MATCHING-2026-11-08.md')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 8 profile & matching: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
