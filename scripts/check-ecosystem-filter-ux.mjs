import fs from 'node:fs'
import assert from 'node:assert/strict'

const registry = fs.readFileSync('lib/navigation/service-registry.ts', 'utf8')
const ecosystem = fs.readFileSync('components/ghc/greenhaven-ecosystem-screen.tsx', 'utf8')
const summary = fs.readFileSync('components/ghc/filtering/filter-summary.tsx', 'utf8')
const result = fs.readFileSync('components/ghc/filtering/filter-result-state.tsx', 'utf8')
const blueprint = fs.readFileSync('docs/GREENHAVEN-41-MODULE-FILTER-UX-AUDIT-AND-BLUEPRINT-2026-11-11.md', 'utf8')

const serviceRegistry = registry.split('export const ECOSYSTEM_SERVICES', 2)[1] || ''
const entries = [...serviceRegistry.matchAll(/\{\s*id: "([^"]+)"[\s\S]*?title: "([^"]+)"[\s\S]*?category: "([^"]+)"[\s\S]*?status: "([A-Z_]+)"/g)]
assert.equal(entries.length, 41, `Expected 41 registered services, found ${entries.length}`)
const active = entries.filter((entry) => ['ACTIVE', 'BETA'].includes(entry[4]))
const comingSoon = entries.filter((entry) => entry[4] === 'COMING_SOON')
assert.equal(active.length, 11, 'Active service count changed; review filter-surface scope')
assert.equal(comingSoon.length, 30, 'Coming Soon service count changed; do not ship fake filter screens')
for (const entry of entries) assert.ok(blueprint.includes(`| ${entry[2]} (\`${entry[1]}\`) |`), `Missing service filter blueprint for ${entry[1]}`)

for (const [name, source] of [['ecosystem', ecosystem], ['filter summary', summary], ['filter result state', result]]) {
  assert.ok(source.includes('focus-visible:ring-2'), `${name} must expose visible keyboard focus`)
}
for (const token of ['categoryFilter', 'statusFilter', 'sortOrder', 'clearDirectoryFilters', 'FilterSummary', 'aria-pressed', 'Showing']) {
  assert.ok(ecosystem.includes(token), `Ecosystem filter UI missing ${token}`)
}
assert.ok(ecosystem.includes('SERVICE_CATEGORIES.map'), 'Category facet must be sourced from canonical category registry')
assert.ok(ecosystem.includes('service.status === "COMING_SOON"'), 'Coming Soon facet must reflect canonical service status')
assert.ok(summary.includes('min-h-8'), 'Active-filter removal targets must remain comfortably tappable')
assert.ok(summary.includes('aria-live="polite"'), 'Active-filter updates must be announced')
assert.ok(result.includes('state === "no-results" && onClear'), 'No-results state must support clear-filter recovery')
assert.ok(result.includes('role="alert"'), 'Filter errors must be announced')
console.log(`PASS: ${entries.length} services inventoried (${active.length} active, ${comingSoon.length} coming soon); ecosystem filter UX contracts passed.`)
