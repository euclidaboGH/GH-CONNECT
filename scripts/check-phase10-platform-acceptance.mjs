#!/usr/bin/env node
/**
 * Programme Phase 10 — Platform-wide acceptance meta-gate (source contracts).
 * Does NOT claim production approval. Live device, Testnet, and operator evidence remain separate.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const prebuild = String(pkg.scripts?.prebuild || '')
const engines = pkg.engines?.node || ''
const truth = existsSync(join(root, 'docs/PROJECT_TRUTH.md')) ? read('docs/PROJECT_TRUTH.md') : ''
const securityHeaders = existsSync(join(root, 'scripts/check-security-headers.mjs'))
  ? read('scripts/check-security-headers.mjs')
  : ''
const a11y = existsSync(join(root, 'scripts/check-global-accessibility-phase10.mjs'))
  ? read('scripts/check-global-accessibility-phase10.mjs')
  : ''
const resilience = existsSync(join(root, 'scripts/check-phase10-resilience.mjs'))
  ? read('scripts/check-phase10-resilience.mjs')
  : ''
const sw = existsSync(join(root, 'scripts/test-phase10-service-worker-policy.mjs'))
  ? read('scripts/test-phase10-service-worker-policy.mjs')
  : ''
const css = existsSync(join(root, 'app/globals.css')) ? read('app/globals.css') : ''

const programmeGates = [
  'check-phase4-identity-authentication.mjs',
  'check-phase5-messages-notifications.mjs',
  'check-phase6-communities-discovery.mjs',
  'check-phase7-marketplace-commerce.mjs',
  'check-phase8-profile-matching.mjs',
  'check-phase9-settings-filters.mjs',
]

for (const gate of programmeGates) {
  test(`programme gate present on disk: ${gate}`, existsSync(join(root, 'scripts', gate)))
  test(`programme gate registered in prebuild: ${gate}`, prebuild.includes(gate))
}

test('Node engines pin 24.15.x family', /\^?24\.15/.test(String(engines)))
test('package lock and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('security headers checker exists', securityHeaders.length > 50)
test('global accessibility phase10 checker exists', a11y.length > 50)
test('accessibility requires reduced-motion handling in CSS', /prefers-reduced-motion:\s*reduce/.test(css))
test('accessibility requires visible focus styles', /:focus-visible/.test(css))
test('resilience checker exists', resilience.length > 50)
test('service worker policy test exists', sw.length > 50)
test('production remains explicitly not approved in project truth', /NOT APPROVED/.test(truth) || /not approved/i.test(truth))
test('phase 10 platform acceptance doc exists', existsSync(join(root, 'docs/PHASE-10-PLATFORM-ACCEPTANCE-2026-11-08.md')))
test('phase 10 checker is registered in prebuild', prebuild.includes('check-phase10-platform-acceptance.mjs'))
test('completion register documents programme phases 1-10', existsSync(join(root, 'docs/PROGRAMME-COMPLETION-REGISTER-2026-11-08.md')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 10 platform-wide acceptance: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
