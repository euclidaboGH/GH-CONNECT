#!/usr/bin/env node
/** Phase 2 database integrity closeout — source-only; never claims remote apply. */
import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))
let passed = 0, failed = 0
const check = (name, ok) => {
  if (ok) { passed++; console.log(`PASS ${name}`) }
  else { failed++; console.error(`FAIL ${name}`) }
}

const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql'))
const versions = migrations.map((f) => f.slice(0, 14))
const unique = new Set(versions)
check('unique 14-digit migration versions match the canonical on-disk inventory', migrations.length > 0 && versions.every((v) => /^\d{14}$/.test(v)) && unique.size === migrations.length)

check('proposals directory exists outside canonical migrations', exists('supabase/proposals'))
const proposals = exists('supabase/proposals')
  ? fs.readdirSync(path.join(root, 'supabase/proposals')).filter((f) => f.endsWith('.sql'))
  : []
check('at least one proposal remains non-canonical', proposals.length >= 1)

// New economy observability proposal must NOT be duplicated into migrations
const phase6Name = '20261109_phase6_earnings_balance_integrity_observability_proposal.sql'
check('phase6 earnings observability proposal lives only under proposals/', proposals.includes(phase6Name) && !migrations.includes(phase6Name))

check('proposal isolation helper exported', exists('lib/server/migrations/proposal-isolation.ts') && /isMigrationProposalPath/.test(read('lib/server/migrations/proposal-isolation.ts')))

const ci = read('.github/workflows/ci.yml')
check('CI does not run supabase db push', !/supabase\s+db\s+push/.test(ci))

const pack = read('scripts/check-phase1-10-upgrade-pack.mjs')
check('Phase 1–10 pack still enforces proposal isolation', /proposals/.test(pack) && /outside canonical migrations/.test(pack))

const phase2Doc = exists('docs/PHASE-2-DATABASE-INTEGRITY-CLOSEOUT-2026-11-09.md')
  ? read('docs/PHASE-2-DATABASE-INTEGRITY-CLOSEOUT-2026-11-09.md')
  : ''
check(
  'Phase 2 closeout report present',
  phase2Doc.includes('Production remains **NOT APPROVED**') &&
    phase2Doc.includes('199') &&
    phase2Doc.includes('proposal-isolation'),
)

console.log(`\nPhase 2 database integrity closeout: ${passed}/${passed + failed} passed`)
process.exit(failed ? 1 : 0)
