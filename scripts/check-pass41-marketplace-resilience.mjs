#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read = (file) => readFileSync(join(process.cwd(), file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const screen = read('components/ghc/marketplace-screen.tsx')
const context = read('contexts/ghc-context.tsx')
const release = read('lib/app-release.ts')
const truth = read('docs/PROJECT_TRUTH.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const prebuild = pkg.scripts?.prebuild || ''
const checks = [
  ['saved listings use latest-request sequencing', /const requestId = \+\+savedRequestRef\.current/.test(screen) && screen.includes('requestId !== savedRequestRef.current')],
  ['seller listings use latest-request sequencing', /const requestId = \+\+mineRequestRef\.current/.test(screen) && screen.includes('requestId !== mineRequestRef.current')],
  ['durable orders use latest-request sequencing', /const requestId = \+\+ordersRequestRef\.current/.test(screen) && screen.includes('requestId !== ordersRequestRef.current')],
  ['transient saved-list failures preserve last known data', screen.includes('Keep the last known list') && !/if \(!remote\.ok \|\| !remote\.durable\)[\s\S]{0,80}setSavedListings\(\[\]\)/.test(screen)],
  ['transient seller-list failures preserve last known data', screen.includes('Preserve the previous seller inventory') && !/if \(!remote\.ok\)[\s\S]{0,80}setMineListings\(\[\]\)/.test(screen)],
  ['transient order failures preserve last known history', screen.includes('never turn a network failure into an empty order history') && !/if \(!res\.ok \|\| !Array\.isArray\(data\.orders\)\) \{ setDurableOrders\(\[\]\)/.test(screen)],
  ['valid authoritative empty arrays still replace stale lists', /setSavedListings\(mapped\)/.test(screen) && /setMineListings\(mapped\)/.test(screen) && /setDurableOrders\(mapped\)/.test(screen)],
  ['loading state is finalized only by the latest request', ['savedRequestRef','mineRequestRef','ordersRequestRef'].every((name) => screen.includes(`requestId === ${name}.current) set`))],
  ['unmount invalidates pending marketplace requests', /useEffect\(\(\) => \(\) => \{[\s\S]*savedRequestRef\.current \+= 1[\s\S]*mineRequestRef\.current \+= 1[\s\S]*ordersRequestRef\.current \+= 1/.test(screen)],
  ['feed refresh aborts superseded requests and unmount work', context.includes('feedRequestRef.current.controller?.abort()') && /useEffect\(\(\) => \(\) => \{\s*feedRequestRef\.current\.controller\?\.abort\(\)/.test(context)],
  ['package, lock, app release and project truth agree', lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && truth.includes(`**Current source version:** \`${pkg.version}\``) && manifest.includes(`project_version=${pkg.version}`)],
  ['Pass 43, Pass 42 and Pass 41 gates retain release order', prebuild.indexOf('check-pass43-domain-session-bridges') < prebuild.indexOf('check-pass42-marketplace-domain-boundary') && prebuild.indexOf('check-pass42-marketplace-domain-boundary') < prebuild.indexOf('check-pass41-marketplace-resilience') && prebuild.indexOf('check-pass41-marketplace-resilience') < prebuild.indexOf('check-pass40-feed-reconciliation')],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`Pass 41 marketplace resilience: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
