#!/usr/bin/env node
/**
 * Phase 10 release-engineering closure contract.
 * Verifies that the same complete source gate is wired into local verification,
 * prebuild, and CI. It does not approve deployments or execute migrations.
 */
import { readFileSync, existsSync } from 'node:fs'
import { hasNodeScript } from './lib/prebuild-command-contract.mjs'
import { hasProjectDoc } from './lib/read-project-doc.mjs'

const read = (path) => readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const ci = read('.github/workflows/ci.yml')
const nvmrc = read('.nvmrc').trim()
const release = read('lib/app-release.ts')
const truth = read('docs/PROJECT_TRUTH.md')
const prebuild = pkg.scripts?.prebuild ?? ''
const prebuildChecks = pkg.scripts?.['prebuild:checks'] ?? ''
const verify = pkg.scripts?.['verify:static'] ?? ''
const commandOptions = { root: process.cwd(), existsSync: (path) => existsSync(path) }
const prebuildHas = (script) => hasNodeScript(prebuildChecks, script, commandOptions)
const verifyHas = (script) => hasNodeScript(verify, script, commandOptions)
const checks = []
const check = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

check('package and lockfile versions are identical', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version)
check('in-app release version matches package version', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
check('Node runtime is pinned to 24.15.0', pkg.engines?.node === '^24.15.0' && nvmrc === '24.15.0')
check('CI installs the exact supported Node runtime', /node-version:\s*24\.15\.0/.test(ci))
check('dependency lock integrity runs before npm ci', ci.indexOf('check-dependency-lock-integrity.mjs') >= 0 && ci.indexOf('check-dependency-lock-integrity.mjs') < ci.indexOf('npm ci'))
check('CI runs the complete static verification suite', /run:\s*npm run verify:static/.test(ci))
check('CI keeps typecheck and lint as explicit gates', /run:\s*npm run typecheck/.test(ci) && /run:\s*npm run lint/.test(ci))
const buildJob = ci.match(/\n  build:\n([\s\S]*?)(?=\n  [a-zA-Z0-9_-]+:\n|$)/)?.[1] ?? ''
function declaresStaticDependency(jobText) {
  const lines = jobText.split(/\r?\n/)
  const index = lines.findIndex((line) => /^\s{4}needs\s*:/.test(line))
  if (index < 0) return false
  const inline = lines[index].replace(/^\s{4}needs\s*:/, '').replace(/\s+#.*$/, '').trim()
  if (inline) {
    if (inline === 'static') return true
    if (/^\[.*\]$/.test(inline)) return inline.slice(1, -1).split(',').map((value) => value.trim().replace(/^['"]|['"]$/g, '')).includes('static')
    return false
  }
  for (const line of lines.slice(index + 1)) {
    if (/^\s{4}\S/.test(line)) break
    const item = line.match(/^\s{6}-\s*['"]?([a-zA-Z0-9_-]+)['"]?\s*(?:#.*)?$/)
    if (item?.[1] === 'static') return true
  }
  return false
}
check('CI builds only after static verification', declaresStaticDependency(buildJob) && /run:\s*npm run build/.test(buildJob))
check('release gate accepts scalar, flow-list, and block-list CI dependencies', [
  declaresStaticDependency('    needs: static\n'),
  declaresStaticDependency('    needs: [static]\n'),
  declaresStaticDependency('    needs:\n      - static\n'),
].every(Boolean))
check('release hygiene runs in prebuild and static verification', prebuild === 'node scripts/run-prebuild-checks.mjs' && prebuildHas('scripts/check-release-hygiene.mjs') && verifyHas('scripts/check-release-hygiene.mjs'))
check('project truth runs in prebuild and static verification', prebuild === 'node scripts/run-prebuild-checks.mjs' && prebuildHas('scripts/check-project-truth.mjs') && verifyHas('scripts/check-project-truth.mjs'))
check('phase 10 closure contract runs in prebuild and static verification', prebuild === 'node scripts/run-prebuild-checks.mjs' && prebuildHas('scripts/check-phase10-release-closure.mjs') && verifyHas('scripts/check-phase10-release-closure.mjs'))
check('phase 10 platform acceptance remains in prebuild and static verification', prebuild === 'node scripts/run-prebuild-checks.mjs' && prebuildHas('scripts/check-phase10-platform-acceptance.mjs') && verifyHas('scripts/check-phase10-platform-acceptance.mjs'))
check('migration classification/review gate remains in both suites', prebuild === 'node scripts/run-prebuild-checks.mjs' && prebuildHas('scripts/check-phase24-release-review.mjs') && verifyHas('scripts/check-phase24-release-review.mjs'))
check('no database push is wired into CI', !/supabase\s+db\s+push/i.test(ci))
check('production remains explicitly not approved', /NOT APPROVED/i.test(truth))
check('release report is present in canonical or preserved historical documentation', hasProjectDoc('docs/PHASE-10-RELEASE-ENGINEERING-ACCEPTANCE-2026-11-09.md'))

const passed = checks.filter(Boolean).length
console.log(`\nPhase 10 release closure: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
