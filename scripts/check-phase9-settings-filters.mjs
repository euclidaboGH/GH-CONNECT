#!/usr/bin/env node
/** Phase 9 Settings & Filters (programme) source contracts. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const persist = read('lib/settings-persistence.ts')
const search = read('lib/settings-search.ts')
const settings = read('components/ghc/settings.tsx')
const filterContract = read('lib/filtering/filter-contract.ts')
const filterUtils = read('lib/filtering/filter-utils.ts')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')

test('settings export blocks secret and token keys', /FORBIDDEN_EXPORT_KEY_RE/.test(persist) && /password|token|pin/.test(persist))
test('settings export payload uses versioned schema marker', /ghc\.settings\.export\.v1/.test(persist))
test('import merge ignores underscore meta and forbidden keys', /mergeImportedSettings/.test(persist) && /key\.startsWith\("_"\)/.test(persist))
test('discovery radius is clamped 1–100 km', /clampDiscoveryRadiusKm/.test(persist) && /Math\.min\(100/.test(persist))
test('age range clamps keep min ≤ max and adult floor', /clampAgeRange/.test(persist) && /ageMin/.test(persist))
test('settings search requires every query token to match', /tokens\.every/.test(search))
test('settings UI uses matchSettingsSearch and clear control', /matchSettingsSearch/.test(settings) && /Clear settings search/.test(settings))
test('settings UI clamps discovery radius via helper', /clampDiscoveryRadiusKm/.test(settings))
test('settings updates prefer narrow patches', /updateSettings\(\{ \[key\]: value \}/.test(settings) || /updateSettings\(\{\s*\[/.test(settings) || /updateSettings\(/.test(settings))
test('filter contract parses ISO dates and bounded ranges', /parseIsoDate/.test(filterContract) && /parseFiniteRange/.test(filterContract))
test('filter utils normalize text and count active filters', /normalizeFilterText/.test(filterUtils) && /countActiveFilters/.test(filterUtils))
test('active filter summary is accessible copy', /describeActiveFilterSummary/.test(filterUtils))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('phase 9 settings-filters checker is registered in prebuild', Boolean(pkg.scripts?.prebuild?.includes('check-phase9-settings-filters.mjs')))
test('phase 9 programme doc exists', existsSync(join(root, 'docs/PHASE-9-SETTINGS-FILTERS-2026-11-08.md')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 9 settings & filters: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
