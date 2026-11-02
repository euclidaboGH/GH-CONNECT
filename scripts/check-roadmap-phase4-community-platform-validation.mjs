#!/usr/bin/env node
/** Phase 4: community platform input boundary regression contracts. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const route = readFileSync('app/api/communities/[id]/platform/route.ts', 'utf8')
const checks = [
  ['user-controlled fields are bounded before RPC calls', route.indexOf('Bound and validate user-controlled fields') >= 0 && route.indexOf('const rl = checkRateLimit') > route.indexOf('Bound and validate user-controlled fields')],
  ['announcement title and content have length bounds', /textField\("title", 160, true\)/.test(route) && /textField\("content", 12000, true\)/.test(route)],
  ['event titles and descriptions are bounded', /textField\("title", 160, true\)/.test(route) && /textField\("description", 12000\)/.test(route)],
  ['event end must be after event start', /endsAt\.getTime\(\) <= startsAt\.getTime\(\)/.test(route)],
  ['virtual event links restrict schemes to HTTP(S)', /url\.protocol !== "https:" && url\.protocol !== "http:"/.test(route)],
  ['resource links restrict schemes to HTTP(S)', (route.match(/url\.protocol !== "https:" && url\.protocol !== "http:"/g) || []).length >= 2],
  ['RSVP statuses are allowlisted', /\["going", "interested", "not_going"\]/.test(route)],
  ['report resolution statuses are allowlisted', /\["resolved", "dismissed", "escalated"\]/.test(route)],
  ['report fields are bounded before RPC', /textField\("targetId", 160, true\)/.test(route) && /textField\("note", 4000\)/.test(route)],
  ['moderation target user IDs are required and bounded', /textField\("targetUserId", 160, true\)/.test(route)],
  ['database RPC remains the mutation authority', /await socialRpc\(fn, rpcBody\)/.test(route)],
  ['no database schema or migration is required by this patch', !/supabase\/migrations/.test(route)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nPhase 4 platform input validation: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Community platform validation checks failed')
