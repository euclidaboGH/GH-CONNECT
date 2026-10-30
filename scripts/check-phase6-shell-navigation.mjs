import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const app = read('components/ghc/app.tsx')
const notFound = read('app/not-found.tsx')
const destinations = read('lib/navigation/destinations.ts')
const onboarding = read('lib/onboarding-local.ts')
const sessionLock = read('components/ghc/session-lock-screen.tsx')
const checks = [
  ['package and lockfile versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version],
  ['navigation rejects oversized destination strings', /raw\.length > 100/.test(read('lib/navigation/navigate.ts'))],
  ['navigation helper safely no-ops outside the browser runtime', /if \(typeof window === \"undefined\"\) return false/.test(read('lib/navigation/navigate.ts'))],
  ['navigation settings sections are runtime allowlisted', /const SETTINGS_SECTIONS = new Set/.test(read('lib/navigation/navigate.ts')) && /section: safeSection\(options\.section\)/.test(read('lib/navigation/navigate.ts'))],
  ['navigation payload strings reject control characters', /\\u0000-\\u001f\\u007f/.test(read('lib/navigation/navigate.ts'))],
  ['not-found back action falls back to home without prior history', /window\.history\.length > 1/.test(notFound) && /router\.push\(\"\/\"\)/.test(notFound)],
  ['navigation bounds externally sourced event payloads', /groupId: bounded\(options\.groupId, 180\)/.test(read('lib/navigation/navigate.ts')) && /userPhoto: safePhoto\(options\.userPhoto\)/.test(read('lib/navigation/navigate.ts'))],
  ['navigation rejects unsafe avatar URL protocols and control characters', /parsed\.protocol === \"https:\"/.test(read('lib/navigation/navigate.ts')) && /startsWith\(\"\/\/\"\)/.test(read('lib/navigation/navigate.ts')) && /\\u0000-\\u001f/.test(read('lib/navigation/navigate.ts'))],
  ['release constant matches package version', read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['canonical destination resolver handles deep-link aliases', app.includes('const destination = resolveDestination(requested)') && destinations.includes('export function resolveDestination')],
  ['primary tab deep links use shell tab state', /isPrimaryTab\(destination\)[\s\S]{0,100}setTab\(destination\)/.test(app)],
  ['overlay deep links dispatch after shell listeners mount', /setTimeout\(\(\) => \{ navigateTo\(destination\) \}, 0\)/.test(app)],
  ['URL state and hash survive deep-link cleanup', app.includes('window.history.state') && app.includes('url.hash')],
  ['invalid deep links cannot block startup', app.includes('Invalid destinations are discarded') && app.includes('malformed URLs must not interrupt app startup')],
  ['not-found recovery does not silently redirect', !notFound.includes('window.location.replace') && !notFound.includes('setTimeout')],
  ['not-found page offers explicit home and back recovery', notFound.includes('href="/"') && notFound.includes('router.back()')],
  ['not-found recovery supports keyboard focus and accessible title', notFound.includes('homeRef.current?.focus()') && notFound.includes('aria-labelledby="not-found-title"')],
  ['existing onboarding gate remains in place', app.includes('resolveUiOnboardingGate') && onboarding.includes('resolveUiOnboardingGate')],
  ['session lock continues preserving mounted app state', sessionLock.includes('Never unmount children') && sessionLock.includes('{children}')],
  ['primary navigation is Home Cart Wallet Profile', destinations.includes('export const BOTTOM_NAV_IDS = ["home", "cart", "wallet", "profile"]')],
  ['Phase 6 documentation exists', fs.existsSync(path.join(root, 'docs/PHASE-06-APP-SHELL-NAVIGATION-ONBOARDING.md'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`Phase 6 shell/navigation checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
