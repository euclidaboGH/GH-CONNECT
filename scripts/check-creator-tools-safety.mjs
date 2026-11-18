#!/usr/bin/env node
import fs from 'node:fs'
const read = (p) => fs.readFileSync(p, 'utf8')
const route = read('app/api/social/creator/route.ts')
const screen = read('components/ghc/creator-tools-screen.tsx')
const ecosystem = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const registry = read('lib/navigation/service-registry.ts')
const checks = [
  ['Creator Tools remains Coming Soon with no live destination', /id: "creator-tools"[\s\S]{0,220}status: "COMING_SOON"[\s\S]{0,120}destination: \{ kind: "none" \}/.test(registry)],
  ['creator GET and POST require the authenticated session', (route.match(/resolveAuthenticatedUser\(request\.headers\)/g) || []).length === 2],
  ['creator reads use a durable fail-closed rate limit', /creator-read:\$\{auth\.userId\}/.test(route) && /checkDurableRateLimit/.test(route) && /onUnavailable: "deny"/.test(route)],
  ['creator writes use a separate durable fail-closed rate limit', /creator-write:\$\{auth\.userId\}/.test(route)],
  ['creator responses are no-store and private', /Cache-Control.*no-store, private/.test(route) && /Vary: "Cookie, Authorization"/.test(route)],
  ['creator writes use bounded JSON', /readBoundedJson\(request, 16 \* 1024\)/.test(route)],
  ['creator owner identity is session-derived; body userId is ignored', /Ignore body\.userId — session only/.test(route) && /userId: auth\.userId/.test(route)],
  ['creator economy aggregation uses server-owned post IDs', /getCreatorEconomySummary\(auth\.userId, postIds\)/.test(route)],
  ['creator data completeness requires every canonical source', /profile\.ok && posts\.ok && economy\?\.ok === true && rep\.ok/.test(route)],
  ['a successfully read absent creator profile is represented as a durable not-enabled state', /durable: profile\.ok && posts\.ok/.test(route) && !/durable: profile\.ok && profile\.exists !== false/.test(route)],
  ['Creator Tools screen uses the authenticated creator overview endpoint', /fetch\("\/api\/social\/creator"/.test(screen)],
  ['Creator Tools screen does not initiate tips, payouts, or reward claims', !/onTip|onPayout|onClaim|\/api\/social\/tips|\/api\/marketplace\/payouts|\/api\/rewards/i.test(screen)],
  ['Creator Tools screen is prepared but not wired into the Coming Soon directory', /CreatorToolsScreen/.test(screen) && !/CreatorToolsScreen/.test(ecosystem)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Creator Tools safety checks: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
