#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const prebuild = pkg.scripts?.prebuild ?? ''
const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'))
const manifest = read('VERIFIED_MANIFEST.txt')
const checks = [
  ['package, lockfile and app release versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['README and project truth identify the current release', read('README.md').includes(`Current source version:** \`${pkg.version}\``) && read('docs/PROJECT_TRUTH.md').includes(`Current source version:** \`${pkg.version}\``)],
  ['verified migration inventory matches release and disk', manifest.includes(`project_version=${pkg.version}`) && manifest.includes(`canonical_migrations=${migrations.length}`) && migrations.length === 170],
  ['project-truth regression gate runs before production build', prebuild.includes('node scripts/check-project-truth.mjs')],
  ['system-integrity gate runs before production build', prebuild.includes('node scripts/check-pass36-system-integrity.mjs')],
  ['production release remains explicitly unapproved pending live evidence', read('docs/PROJECT_TRUTH.md').includes('NOT APPROVED') && read('docs/PROJECT_TRUTH.md').includes('does not establish')],
  ['runtime contract remains pinned to Node 24.15.0', pkg.engines?.node === '^24.15.0' && read('.nvmrc').trim() === '24.15.0'],
  ['canonical five-item navigation contract remains documented', read('lib/navigation/destinations.ts').includes('[\"home\", \"messages\", \"communities\", \"cart\", \"profile\"]') && read('docs/release-0.259.0-pass37.md').includes('Wallet remains an overlay')],
]
let failures = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failures += 1
}
console.log(`Pass 36 system integrity: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
