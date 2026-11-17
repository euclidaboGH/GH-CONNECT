#!/usr/bin/env node
/** Run #305: Quiet Premium UI consistency and Coming Soon release-boundary gate. */
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const registry = read('lib/navigation/service-registry.ts')
const ecosystem = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const css = read('app/globals.css')
const release = read('lib/app-release.ts')
const areas = {
  feed: 'components/ghc/enhanced-feed-screen.tsx',
  wallet: 'features/wallet/wallet-screen.tsx',
  rewards: 'components/ghc/rewards-centre-screen.tsx',
  membership: 'components/ghc/premium-membership-screen.tsx',
  profile: 'components/ghc/profile-screen.tsx',
  settings: 'components/ghc/settings.tsx',
  communities: 'components/ghc/communities-screen.tsx',
  messages: 'components/ghc/message-screen.tsx',
  marketplace: 'components/ghc/marketplace-screen.tsx',
  filters: 'components/ghc/filtering/filter-panel.tsx',
  notifications: 'components/ghc/notification-bell.tsx',
}
const checks = []
const add = (name, ok) => checks.push({ name, ok: Boolean(ok) })
const statusMatches = [...registry.matchAll(/status: "(ACTIVE|BETA|COMING_SOON|UNAVAILABLE)"/g)].map((m) => m[1])
add('all eleven approved product priorities have explicit module roots', Object.entries(areas).every(([id, path]) => read(path).includes(`data-gh-module="${id}"`)))
add('the current product release identity is synchronized', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && /^\d+\.\d+\.\d+$/.test(pkg.version))
add('the interface regression gate is registered once in both quality pipelines', ['prebuild:checks', 'verify:static'].every((key) => (pkg.scripts[key].match(/check-run305-quiet-premium-interface\.mjs/g) || []).length === 1))
add('shared premium design tokens and dark-mode values exist', /--gh-premium-canvas/.test(css) && /\.dark\s*\{[\s\S]*?--gh-premium-canvas/.test(css))
add('the shared premium layer preserves user-selected theme tokens', /--gh-premium-canvas:\s*var\(--gh-ref-canvas/.test(css) && /--gh-premium-surface:\s*var\(--gh-ref-surface/.test(css))
add('all eleven product priorities have scoped surface rules', Object.keys(areas).every((id) => css.includes(`[data-gh-module="${id}"]`)))
add('shared chrome and controls use the premium visual language', /\.gh-page-chrome/.test(css) && /\.gh-bottom-nav/.test(css) && /\.gh-create-fab\s*\{[^}]*background: var\(--primary\)/s.test(css))
add('focus and reduced-motion behavior remain supported', /focus-visible/.test(css) && /prefers-reduced-motion:\s*reduce/.test(css))
add('Coming Soon briefs disclose all thirty service-specific tracks', /getServiceUpgradePlan\(service\)\.map/.test(ecosystem) && /30 upgrade tracks in preparation/.test(ecosystem))
add('Coming Soon work is visibly in development and remains unavailable', /In development/.test(ecosystem) && /Availability stays off/.test(ecosystem) && /explicitly released/.test(ecosystem))
add('all 30 Coming Soon services retain no live destination', statusMatches.filter((s) => s === 'COMING_SOON').length === 30 && /destination: \{ kind: "none" \}/.test(registry))
add('active service statuses and canonical registry count are unchanged', statusMatches.length === 42 && statusMatches.filter((s) => s === 'ACTIVE').length === 12)
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} Run #305: ${c.name}`)
const failed = checks.filter((c) => !c.ok)
console.log(`\nRun #305 Quiet Premium interface: ${checks.length - failed.length}/${checks.length} passed; ${failed.length} failed.`)
if (failed.length) process.exit(1)
