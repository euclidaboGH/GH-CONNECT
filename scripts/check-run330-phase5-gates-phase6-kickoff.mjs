#!/usr/bin/env node
import fs from 'node:fs'
const readProjectText = (path) => {
  const archived = path.startsWith('docs/')
    ? `docs/archive/historical-implementation-records/docs__${path.slice('docs/'.length)}`
    : null
  const resolved = fs.existsSync(path) ? path : archived && fs.existsSync(archived) ? archived : path
  return fs.readFileSync(resolved, 'utf8')
}
const doc = readProjectText('docs/RUN330-PHASE5-RELEASE-GATES-AND-PHASE6-PROFILE-PERFORMANCE-KICKOFF-2026-11-18.md')
const index = fs.readFileSync('lib/domains/profile-relationship-index.ts', 'utf8')
const checks = [
  ['all five Phase 5 runs have explicit dispositions', ['RUN327','RUN328','RUN329','RUN330','RUN331'].every((run) => doc.includes(run))],
  ['Phase 5 is not falsely marked release complete', /Phase 5 disposition: NOT CLOSED for release/.test(doc)],
  ['database rehearsal remains an explicit blocker', /no disposable PostgreSQL 17 instance/.test(doc)],
  ['tally reconciliation is separate from certification', /No tally is certified/.test(doc)],
  ['geography requires licensed provenance', /authoritative licensed geographic dataset/.test(doc)],
  ['scanner unknown states remain quarantined', /remain quarantined/.test(doc)],
  ['Mainnet remains disabled and untouched', /Mainnet remains disabled/.test(doc) && /Mainnet remains untouched/.test(doc)],
  ['Phase 6 profile/identity track has ten objectives', (doc.match(/^\d+\. \*\*/gm) || []).length === 10],
  ['relationship identity length is bounded', index.includes('MAX_PROFILE_ID_LENGTH = 256')],
  ['derived relationship-set memory is bounded', index.includes('MAX_PROFILE_RELATIONSHIP_IDS = 50_000')],
  ['batch hydration has a default and absolute bound', index.includes('DEFAULT_PROFILE_BATCH_LIMIT = 500') && index.includes('Math.min(limit, 5_000)')],
  ['block-first and canonical financial separation are documented', /block-first/.test(doc) && /wallet, PI\/GHC balances, ledger, payment, payout and entitlement data remain excluded/.test(doc)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`RUN330 Phase 5 gates / Phase 6 kickoff: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
