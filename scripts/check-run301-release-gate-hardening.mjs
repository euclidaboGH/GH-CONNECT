#!/usr/bin/env node
/** Run #301: independent, network-free release metadata and safety regression gate. */
import { readFileSync, existsSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const version = pkg.version
const truth = read('docs/PROJECT_TRUTH.md')
const readme = read('README.md')
const acceptance = read('docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md')
const phase12 = read('docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md')
const phase24 = read('scripts/check-phase24-release-review.mjs')
const worklogPath = `docs/UPGRADE-WORKLOG-${version}.md`
const worklog = existsSync(worklogPath) ? read(worklogPath) : ''
const manifest = read('VERIFIED_MANIFEST.txt')
const workflows = read('.github/workflows/ci.yml')
const checks = [
  ['package version is a semantic release', /^\d+\.\d+\.\d+$/.test(version)],
  ['lockfile version matches package', lock.version === version],
  ['lockfile root version matches package', lock.packages?.['']?.version === version],
  ['README identifies current baseline', readme.includes(`Current source version:** \`${version}\``)],
  ['project truth identifies current baseline', truth.includes(`Current source version:** \`${version}\``)],
  ['acceptance fixture identifies current baseline', acceptance.includes(`Current source baseline for this consolidated report: \`${version}\``)],
  ['acceptance fixture audit status is current', acceptance.includes(`Current audit status (v${version})`)],
  ['Phase 12 release identifies current baseline', phase12.includes(`Release: \`${version}\``)],
  ['Phase 12 current baseline is synchronized', phase12.includes(`**Current source baseline:** \`${version}\``)],
  ['Phase 12 production release remains blocked', /NOT APPROVED for production/.test(phase12)],
  ['current versioned worklog exists', worklog.length > 0],
  ['worklog records 20 upgrades', (worklog.match(/^\d+\. /gm) || []).length === 20],
  ['worklog records source-only verification limits', /source-only verification scope|source-level/i.test(worklog)],
  ['worklog records required Node runtime', /Node(?:\.js)? 24\.15\.0/.test(worklog)],
  ['Phase 24 checks current acceptance metadata', phase24.includes('Phase 1–12 acceptance')],
  ['Phase 24 checks current versioned worklog', phase24.includes('current worklog')],
  ['verified migration manifest matches current package', manifest.includes(`project_version=${version}`)],
  ['CI contents permission remains read-only', /permissions:\s*\n\s+contents:\s*read/m.test(workflows)],
  ['CI does not apply Supabase migrations', !/supabase\s+db\s+push/i.test(workflows)],
  ['CI does not deploy Vercel production', !/vercel\s+(?:deploy\s+)?--prod\b/i.test(workflows)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} Run #301: ${label}`); if (!ok) failed++ }
console.log(`\nRun #301 release-gate hardening: ${checks.length - failed}/${checks.length} passed; ${failed} failed.`)
if (failed) process.exit(1)
