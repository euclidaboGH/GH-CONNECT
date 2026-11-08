#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const notFound = read('app/not-found.tsx')
const errorPage = read('app/error.tsx')
const readiness = read('lib/server/readiness.ts')
const robots = read('app/robots.ts')
const sitemap = read('app/sitemap.ts')
const doc = existsSync(join(root, 'docs/MAINTENANCE-GAPFILL-20-2026-11-08.md'))
  ? read('docs/MAINTENANCE-GAPFILL-20-2026-11-08.md')
  : ''
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const prebuild = String(pkg.scripts?.prebuild || '')

test('not-found links to support', /href="\/support"/.test(notFound))
test('not-found links to privacy and terms', /href="\/privacy"/.test(notFound) && /href="\/terms"/.test(notFound))
test('error boundary links to support', /\/support/.test(errorPage))
test('robots.ts allows legal routes and disallows api', /\/privacy/.test(robots) && /\/api\//.test(robots))
test('sitemap lists privacy terms support', /\/privacy/.test(sitemap) && /\/terms/.test(sitemap) && /\/support/.test(sitemap))
test('readiness reports programmePhase', /programmePhase:\s*"10-platform-acceptance"/.test(readiness))
test('filtering index barrel exists', existsSync(join(root, 'lib/filtering/index.ts')))
test('settings-persistence module exists', existsSync(join(root, 'lib/settings-persistence.ts')))
test('relationship-integrity module exists', existsSync(join(root, 'lib/server/social/relationship-integrity.ts')))
test('marketplace-integrity module exists', existsSync(join(root, 'lib/server/marketplace/marketplace-integrity.ts')))
test('community-integrity module exists', existsSync(join(root, 'lib/server/community/community-integrity.ts')))
test('messaging-integrity module exists', existsSync(join(root, 'lib/server/messaging/messaging-integrity.ts')))
test('auth-integrity module exists', existsSync(join(root, 'lib/server/identity/auth-integrity.ts')))
test('notification deep-link sanitize exists', /sanitizeNotificationDeepLink/.test(read('lib/notification-center.ts')))
test('programme completion register exists', existsSync(join(root, 'docs/PROGRAMME-COMPLETION-REGISTER-2026-11-08.md')))
test('phase 10 platform acceptance gate exists', existsSync(join(root, 'scripts/check-phase10-platform-acceptance.mjs')))
test('maintenance gapfill doc lists 20 items', /\| 20 \|/.test(doc) && /Gap \/ missing part/.test(doc))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('maintenance gapfill checker registered in prebuild', prebuild.includes('check-maintenance-gapfill-20.mjs'))
test('Node engines remain 24.15.x', /\^?24\.15/.test(String(pkg.engines?.node || '')))

const failed = checks.filter((x) => !x).length
console.log(`\nMaintenance gap-fill 20: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
