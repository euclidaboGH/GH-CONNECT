#!/usr/bin/env node
/** Phase 12 source-only release gate. Never contacts or mutates external systems. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const manifest = read('VERIFIED_MANIFEST.txt')
const runner = read('scripts/verify-phase14-static.mjs')
const truth = read('docs/PROJECT_TRUTH.md')
const readme = read('README.md')
const acceptance = read('docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md')
const phase12 = read('docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md')
const migrationDir = path.join(process.cwd(), 'supabase/migrations')
const migrations = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort()
const migrationVersions = new Map()
for (const name of migrations) {
  const version = (name.match(/^(\d+)_/) || [])[1]
  if (version) migrationVersions.set(version, [...(migrationVersions.get(version) ?? []), name])
}
const duplicateVersions = [...migrationVersions].filter(([, names]) => names.length > 1)
const manifestRows = [...manifest.matchAll(/^\[(REQUIRED|REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED)\] size=\d+ path=supabase\/migrations\/([^\r\n]+)$/gm)]
const manifestCounts = Object.fromEntries(['REQUIRED','REQUIRES_APPROVAL','PROPOSAL','REVIEW_REQUIRED'].map((kind) => [kind, manifestRows.filter((row) => row[1] === kind).length]))
const manifestPaths = manifestRows.map((row) => row[2]).sort()
const diskPaths = migrations.map((name) => name).sort()
const checks = [
  ['package, lockfile root, and app release versions agree', /^\d+\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['verified manifest version matches package', manifest.includes(`project_version=${pkg.version}`)],
  ['README and project truth identify current release', readme.includes(`Current source version:** \`${pkg.version}\``) && truth.includes(`**Current source version:** \`${pkg.version}\``)],
  ['Phase 1–12 acceptance report identifies current baseline', acceptance.includes(`Current source baseline for this consolidated report: \`${pkg.version}\``) && acceptance.includes(`Current audit status (v${pkg.version})`)],
  ['Phase 12 report identifies current release and blocks unapproved production release', phase12.includes(`Release: \`${pkg.version}\``) && /NOT APPROVED for production/.test(phase12)],
  ['Phase 3 recovery documentation exists', fs.existsSync('docs/PHASE-03-DATABASE-INTEGRITY-RECOVERY.md')],
  ['Phase 4 recovery release gate documentation exists', fs.existsSync('docs/PHASE-04-RECOVERY-RELEASE-GATE.md')],
  ['Phase 5 design system documentation exists', fs.existsSync('docs/PHASE-05-BRANDING-DESIGN-SYSTEM.md')],
  ['Phase 6 app shell documentation exists', fs.existsSync('docs/PHASE-06-APP-SHELL-NAVIGATION-ONBOARDING.md')],
  ['Phase 7 social reliability documentation exists', fs.existsSync('docs/PHASE-07-SOCIAL-EXPERIENCE-RELIABILITY.md')],
  ['Phase 8 wallet reliability documentation exists', fs.existsSync('docs/PHASE-08-WALLET-FINANCIAL-RELIABILITY.md')],
  ['Phase 9 transaction integration documentation exists', fs.existsSync('docs/PHASE-09-WALLET-TRANSACTION-INTEGRATION.md')],
  ['Phase 10 marketplace integrity documentation exists', fs.existsSync('docs/PHASE-10-MARKETPLACE-ORDER-FULFILMENT-INTEGRITY.md')],
  ['Phase 11 cross-feature reconciliation documentation exists', fs.existsSync('docs/PHASE-11-WALLET-CROSS-FEATURE-RECONCILIATION.md')],
  ['Phase 12 Pi receipt source check is present', fs.existsSync('scripts/check-phase12-pi-transaction-details.mjs')],
  ['Phase 12 final integration report exists', fs.existsSync('docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md')],
  ['Phase 12 release check is registered as an npm script', pkg.scripts?.['check:phase12-final-release-readiness'] === 'node scripts/check-phase12-final-release-readiness.mjs'],
  ['Phase 12 release check is part of static verification', runner.includes('check-phase12-final-release-readiness.mjs')],
  ['audit-UX regression check is independently registered in static suite', runner.includes('["check-phase1-12-audit-ux.mjs", "Phase 1–12 audit UX regression audit"]')],
  ['static verification includes recovery, payment, marketplace and reconciliation gates', ['check-phase3-database-recovery.mjs','check-phase4-recovery-release-gate.mjs','check-phase10-marketplace-integrity.mjs','check-phase11-wallet-cross-feature-reconciliation.mjs','check-phase15-payment-recovery.mjs','check-phase16-payment-timeline.mjs'].every(s => runner.includes(s))],
  ['canonical migration inventory matches manifest exactly', migrations.length > 0 && JSON.stringify(diskPaths) === JSON.stringify(manifestPaths)],
  ['manifest migration total and class totals match actual rows', Number((manifest.match(/^canonical_migrations=(\d+)$/m) || [])[1]) === migrations.length && ['REQUIRED','REQUIRES_APPROVAL','PROPOSAL','REVIEW_REQUIRED'].every((kind) => Number((manifest.match(new RegExp(`^classification_${kind.toLowerCase()}=(\\d+)$`, 'm')) || [])[1]) === manifestCounts[kind])],
  ['migration versions have no duplicates', duplicateVersions.length === 0],
  ['migration inventory is clearly source-only and not applied-state evidence', /does NOT prove migrations are applied to any Supabase project/i.test(manifest) && /source migration inventory is not evidence of applied migrations/i.test(truth)],
  ['project truth retains supported runtime requirement', /\^24\.15\.0/.test(truth) && /TypeScript, lint, and Next\.js production build/.test(truth)],
  ['release report explicitly requires operator verification', /Require explicit operator approval/.test(phase12) || /explicit operator approval/i.test(phase12)],
  ['no deployment or production mutation is claimed by final gate', /never contacts or mutates external systems/i.test(read('scripts/check-phase12-final-release-readiness.mjs')) && /No production database/.test(phase12)],
  ['stale nested duplicate project tree is absent', !fs.existsSync('greenhaven-upgrade-next')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 12 final integration/release readiness: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
