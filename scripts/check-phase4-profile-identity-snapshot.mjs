#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const component = readFileSync('components/ghc/profile-identity-overview.tsx', 'utf8')
const helper = readFileSync('lib/domains/profile-identity-snapshot.ts', 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['profile identity uses the shared validated snapshot parser', component.includes('parseProfileIdentitySnapshot(f, r, a)')],
  ['all three identity endpoints must succeed before values are rendered', /!followRes\.ok \|\| !repRes\.ok \|\| !achRes\.ok/.test(component)],
  ['invalid response contracts fail instead of becoming default zeros', helper.includes('row.ok !== true') && helper.includes('Number.NaN')],
  ['achievement payload must be an array', helper.includes('Array.isArray(achievements.achievements)')],
  ['progress is bounded to the valid 0..1 interval', helper.includes('progress > 1')],
  ['durability requires explicit confirmation from all sources', /follows\.durable === true && reputation\.durable === true && achievements\.durable === true/.test(helper)],
  ['runtime regression is registered in prebuild checks', pkg.scripts['prebuild:checks'].includes('test-phase4-profile-identity-snapshot.mjs')],
  ['runtime regression is registered in static verification', pkg.scripts['verify:static'].includes('test-phase4-profile-identity-snapshot.mjs')],
]
let passed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (ok) passed++ }
console.log(`Phase 4 profile identity snapshot: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
