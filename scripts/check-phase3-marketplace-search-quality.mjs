import fs from 'node:fs'
const component = fs.readFileSync('components/ghc/marketplace-screen.tsx', 'utf8')
const helper = fs.readFileSync('lib/active-upgrades/marketplace.ts', 'utf8')
const checks = [
  ['marketplace query is normalized with Unicode NFKC', helper.includes('.normalize(\'NFKC\')')],
  ['control characters and repeated whitespace are removed', helper.includes('\\u0000-\\u001f') && helper.includes('replace(/\\s+/g')],
  ['search input is bounded to 100 characters', helper.includes('.slice(0, 100)')],
  ['persisted account-scoped filters are normalized on read', component.includes('query: normalizeListingSearch(raw.query)')],
  ['live search input uses the same canonical normalization', component.includes('browseFilters.update("query", normalizeListingSearch(value))')],
  ['normalized search still uses server-side filtering before page ranking', component.includes('socialFetchMarketplaceListings') && component.includes('rankByRelevance')],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`Phase 3 marketplace search quality: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
