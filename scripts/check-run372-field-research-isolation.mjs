#!/usr/bin/env node
/** RUN372 — hard isolation of the temporarily suspended Field Research service. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const middleware = read('middleware.ts')
const registry = read('lib/navigation/service-registry.ts')
const policy = read('lib/routing/public-route-policy.ts')
const robots = read('app/robots.ts')
const navigate = read('lib/navigation/navigate.ts')
const ecosystemScreen = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const checks = [
  ['research API prefixes are intercepted before handlers execute', /isResearchApi/.test(middleware) && /\/api\/research/.test(middleware) && /\/api\/field/.test(middleware)],
  ['research APIs fail closed with 503 and no-store', /FIELD_RESEARCH_TEMPORARILY_DISABLED/.test(middleware) && /status: 503/.test(middleware) && /Cache-Control.*no-store/.test(middleware)],
  ['research pages and public share links return non-disclosing 404', /isResearchPage/.test(middleware) && /path === "\/r"/.test(middleware) && /status: 404/.test(middleware)],
  ['middleware matcher covers APIs, field pages and research share links', /matcher: \["\/api\/:path\*", "\/field", "\/field\/:path\*", "\/r", "\/r\/:path\*"\]/.test(middleware)],
  ['Field Research registry entry is unavailable with no destination', /id: "field-research"[\s\S]*?status: "UNAVAILABLE"[\s\S]*?destination: \{ kind: "none" \}/.test(registry)],
  ['research routes are not public-route allowlisted', !policy.includes('^\\/r\\/[^/]+\\/?$') && !policy.includes('return path === "/field"')],
  ['search crawlers are told not to index suspended research routes', /disallow: \[.*"\/field".*"\/r"/.test(robots)],
  ['direct Field Research navigation is removed from both navigation layers', !navigate.includes('location.assign("/field/studio")') && !ecosystemScreen.includes('location.assign("/field/studio")')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nRUN372 Field Research isolation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
