#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const failures = []
const read = (path) => readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const readme = read('README.md')
const truth = read('docs/PROJECT_TRUTH.md')
const readiness = read('docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md')
const prebuild = pkg.scripts.prebuild ?? ''
const verify = pkg.scripts['verify:static'] ?? ''
const version = pkg.version

if (pkg.version !== version) failures.push(`package version must be ${version}`)
if (lock.version !== version || lock.packages?.['']?.version !== version) failures.push('package-lock root version is not synchronized')
if (!release.includes(`APP_RELEASE_VERSION = "${version}"`)) failures.push('in-app release version is not synchronized')
for (const [name, content] of [['README', readme], ['project truth', truth], ['release readiness', readiness]]) {
  if (!content.includes(version)) failures.push(`${name} does not identify current baseline ${version}`)
}
if (!/production status:\s*\*\*NOT APPROVED\*\*/i.test(readme)) failures.push('README must preserve the production NOT APPROVED boundary')
if (!/Current status:\*\*\s*\*\*NOT APPROVED\*\*/i.test(truth)) failures.push('project truth must preserve the production NOT APPROVED boundary')

const requiredGates = [
  'check-phase18-account-privacy-media.mjs',
  'check-phase19-creator-commerce-integrity.mjs',
  'check-phase20-payout-durable-limits.mjs',
  'check-phase21-private-surface-durable-controls.mjs',
  'check-phase22-marketplace-atomic-transitions.mjs',
  'check-phase23-migration-integrity.mjs',
  'check-phase24-release-review.mjs',
  'check-phase26-wallet-ledger-resilience.mjs',
  'check-migration-source-manifest.mjs',
]
for (const gate of requiredGates) {
  if (!prebuild.includes(gate)) failures.push(`prebuild is missing ${gate}`)
  if (!verify.includes(gate)) failures.push(`verify:static is missing ${gate}`)
}

const inventoryCheck = spawnSync(process.execPath, ['scripts/generate-migration-inventory.mjs', '--check'], { encoding: 'utf8' })
if (inventoryCheck.status !== 0) failures.push(`generated migration inventory is out of sync: ${(inventoryCheck.stderr || inventoryCheck.stdout || '').trim()}`)
const manifestCheck = spawnSync(process.execPath, ['scripts/check-migration-source-manifest.mjs'], { encoding: 'utf8' })
if (manifestCheck.status !== 0) failures.push(`migration classification/apply guide contract failed: ${(manifestCheck.stderr || manifestCheck.stdout || '').trim()}`)

const migrationFiles = read('MIGRATION-SOURCE-MANIFEST.csv').trim().split(/\r?\n/).slice(1)
const verifiedManifest = read('VERIFIED_MANIFEST.txt')
const verifiedCount = Number((verifiedManifest.match(/^canonical_migrations=(\d+)$/m) || [])[1])
if (migrationFiles.length !== verifiedCount || !verifiedManifest.includes('inventory_status=OK')) failures.push(`migration source manifest does not match verified inventory: ${migrationFiles.length} vs ${verifiedCount}`)
const guide = read('supabase/TESTNET_APPLY_ORDER.md')
if (!guide.includes('This is a review order, not permission to apply')) failures.push('Testnet migration guide lacks explicit non-approval warning')
if (!guide.includes('Never run `supabase db push`')) failures.push('Testnet migration guide lacks db push safety warning')
if (/\|\s*\d+\s*\|\s*`[^`]+`\s*\|\s*(?:REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED)\s*\|\s*APPLY\s*\|/m.test(guide)) failures.push('held/proposal migration is incorrectly marked APPLY')

if (failures.length) {
  console.error(`Phase 24 final release review: FAIL (${failures.length})`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('Phase 24 final release review: PASS (release truth, critical gate registration, migration classifications, generated inventory and operator guide synchronized)')
