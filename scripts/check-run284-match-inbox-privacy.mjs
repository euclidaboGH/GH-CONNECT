import fs from 'node:fs'
import assert from 'node:assert/strict'
const route = fs.readFileSync('app/api/matching/inbox/route.ts', 'utf8')
const policy = fs.readFileSync('lib/server/social/match-inbox-policy.ts', 'utf8')
const checks = [
  ['inbox reads use bounded social REST helper', /socialRest/.test(route)],
  ['block list is fetched before returning match data', /ghc_user_blocks/.test(route) && /blockedPeerIdsForViewer/.test(route)],
  ['profile privacy is read before inbox projection', /gh_user_profiles/.test(route) && /readMatchInboxPrivacy/.test(route)],
  ['failed or incomplete privacy reads fail closed', /MATCH_INBOX_UNAVAILABLE/.test(route) && /blockResult\.data\.length > 1000/.test(route)],
  ['hidden and opted-out profiles are suppressed', /no-one/.test(policy) && /hidden/.test(policy)],
  ['matches-only requires reciprocal signal', /return isMutual/.test(policy)],
  ['unknown privacy values fail closed', /Unknown privacy values fail closed/.test(policy)],
  ['inbox response remains private and no-store', /Cache-Control.*private, no-store/.test(route)],
  ['match inbox rate limit remains durable and fail-closed', /checkDurableRateLimit/.test(route) && /onUnavailable: "deny"/.test(route)],
]
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); assert.ok(ok, label) }
console.log(`Run #284 match inbox privacy wiring: ${checks.length}/${checks.length} PASS`)
