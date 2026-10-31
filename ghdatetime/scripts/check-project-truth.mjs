#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const readme = read('README.md')
const truth = read('docs/PROJECT_TRUTH.md')
const checklist = read('docs/MIGRATION_CHECKLIST.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const migrationCount = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).length
const errors = []
let total = 0
function check(condition, label) {
  total += 1
  if (condition) console.log(`PASS ${label}`)
  else errors.push(label)
}
check(pkg.version === lock.version && pkg.version === lock.packages?.['']?.version, 'package and lockfile root versions match')
check(release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`), 'in-app release version matches package version')
check(readme.includes(`Current source version:** \`${pkg.version}\``), 'README baseline matches package version')
check(truth.includes(`**Current source version:** \`${pkg.version}\``), 'project-truth document matches package version')
check(manifest.includes(`project_version=${pkg.version}`), 'verified manifest matches package version')
check(manifest.includes(`canonical_migrations=${migrationCount}`), 'verified manifest migration count matches disk')
check(checklist.includes(`**On-disk count:** **${migrationCount}**`), 'migration checklist count matches disk')
check(truth.includes('NOT APPROVED') && truth.includes('does not establish'), 'release status and verification limits are explicit')
check(pkg.engines?.node === '^24.15.0' && read('.nvmrc').trim() === '24.15.0', 'runtime pin and package engine agree')
check(pkg.scripts?.['check:project-truth'] === 'node scripts/check-project-truth.mjs', 'project-truth check is registered')
if (errors.length) {
  console.error(`\nProject truth check: ${errors.length} failure(s)`)
  for (const error of errors) console.error(`FAIL ${error}`)
  process.exit(1)
}
console.log(`\nProject truth check: ${total} checks passed, 0 failures.`)
