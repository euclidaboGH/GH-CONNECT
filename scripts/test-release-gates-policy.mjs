#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const policy = read('docs/GREENHAVEN_REPUTATION_CURATION_POLICY.md')
const status = read('docs/archive/historical-reports-2026-10-22/PHASE_2_CURATION_IMPLEMENTATION_STATUS.md')
const runbook = read('docs/TESTNET_LIVE_RELEASE_GATES.md')
const settlement = read('supabase/migrations/20261022010070_ghpv_calibration_bounds.sql')
const checks = [
  ['settlement RPC explicitly reports no GHC mutation', /'ghcMutated', false/.test(settlement)],
  ['settlement RPC is service-role only', /REVOKE ALL ON FUNCTION public\.gh_ghpv_commit_settlement/.test(settlement) && /TO service_role/.test(settlement)],
  ['curation-to-reputation bridge remains gated pending compensation', /settled-curation reputation awards remain gated off/.test(policy)],
  ['self-curation is excluded from independent evidence and rewards', /Self-curation is allowed for encouragement\/display/.test(policy) && /does not count as independent validation and cannot mint GHC or reputation/.test(policy)],
  ['quality/social split remains server-authoritative 80/20 target', /80% quality and reputable system activity, 20% social interaction/.test(policy) && /server-owned evidence/.test(policy)],
  ['anti-abuse action is review/throttle, not single-signal irreversible punishment', /trigger throttling\/review, not automatic irreversible punishment/.test(policy)],
  ['live migration procedure explicitly forbids blind push', /Do not apply all files in `supabase\/migrations` blindly/.test(runbook)],
  ['runbook requires two separate test accounts', /two dedicated Testnet accounts with separate browser sessions/.test(runbook)],
  ['implementation status discloses no live migration', /Did not apply any live database migrations/.test(status)],
]
let failed = 0
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failed++ }
console.log(`\nRELEASE GATES POLICY: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
