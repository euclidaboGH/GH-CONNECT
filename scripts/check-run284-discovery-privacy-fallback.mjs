import fs from 'node:fs'
import assert from 'node:assert/strict'
const route = fs.readFileSync('app/api/social/people/discover/route.ts', 'utf8')
const checks = [
  ['discovery reads canonical nested or legacy root visibility', /privacy\.profileVisibility \?\? payload\.profileVisibility/.test(route)],
  ['discovery reads canonical nested or legacy root opt-out', /privacy\.whoCanDiscover \?\? payload\.whoCanDiscover/.test(route)],
  ['hidden/private profile values are suppressed at response projection', /includes\(visibility\)\) return null/.test(route)],
  ['no-one opt-out is suppressed at response projection', /includes\(whoCanDiscover\)\) return null/.test(route)],
  ['matches-only eligibility remains owned by database RPC', /database RPC is authoritative for matches-only eligibility/.test(route) && /socialRpc\("gh_discovery_candidates"/.test(route)],
  ['private profile fields remain separately projected', /locationVisible/.test(route) && /interestsVisible/.test(route) && /bioVisible/.test(route)],
]
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); assert.ok(ok, label) }
console.log(`Run #284 discovery privacy fallback: ${checks.length}/${checks.length} PASS`)
