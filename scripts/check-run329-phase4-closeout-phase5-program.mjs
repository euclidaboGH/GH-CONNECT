#!/usr/bin/env node
/** RUN329: source closeout and 50-item Phase 5 programme integrity. */
import { readFileSync, existsSync } from 'node:fs'
const docCandidates = [
  'docs/RUN329-PHASE4-CLOSEOUT-PHASE5-50-UPGRADE-PROGRAM-2026-11-18.md',
  'docs/archive/historical-implementation-records/docs__RUN329-PHASE4-CLOSEOUT-PHASE5-50-UPGRADE-PROGRAM-2026-11-18.md',
]
const docPath = docCandidates.find((candidate) => existsSync(candidate))
const doc = docPath ? readFileSync(docPath, 'utf8') : ''
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const truth = readFileSync('docs/SOURCE_OF_TRUTH.md', 'utf8')
const checks = [
  ['Phase 4 closeout document exists in canonical or historical location', Boolean(docPath)],
  ['all five roadmap runs are explicitly present', ['RUN327','RUN328','RUN329','RUN330','RUN331'].every((run) => doc.includes(`### ${run}`))],
  ['exactly ten numbered upgrades are specified for each run', ['RUN327','RUN328','RUN329','RUN330','RUN331'].every((run) => { const start = doc.indexOf(`### ${run}`); const end = doc.indexOf('\n### RUN', start + 5); const section = doc.slice(start, end < 0 ? undefined : end); return [...section.matchAll(/^\d+\. \*\*/gm)].length === 10 })],
  ['all selected Phase 4 tracks and their external blockers are recorded', /Identity & Authentication/.test(doc) && /Community discussion/.test(doc) && /Messenger community/.test(doc) && /External Phase 4 release blockers/.test(doc)],
  ['election reconciliation is explicitly not certification', /reconciliation is not official certification/i.test(doc)],
  ['geography imports require provenance and approval', /source authority, jurisdiction, publication date, license/.test(doc) && /signed approval/.test(doc)],
  ['scanner unknown/error states remain quarantined', /unknown results remain quarantined/.test(doc)],
  ['marketplace checkout keeps payment authority server-side', /client-authored paid status/.test(doc) && /verified Pi SDK\/server evidence/.test(doc)],
  ['database and runtime environment limits are stated honestly', /no `psql`/.test(doc) && /Node `22\.16\.0`/.test(doc) && /45 recorded rows/.test(doc)],
  ['no automatic migration push or Mainnet activation is introduced', /no automatic `db push`/.test(doc) && /Mainnet remains untouched/.test(doc)],
  ['RUN329 programme is recorded in source of truth', /RUN329 Phase 4 source closeout and Phase 5 five-run \/ 50-upgrade programme/.test(truth)],
  ['RUN329 gate is registered in static and prebuild checks', ['verify:static','prebuild:checks'].every((key) => (pkg.scripts[key] || '').includes('check-run329-phase4-closeout-phase5-program.mjs'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`RUN329 Phase 4 closeout / Phase 5 programme: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
