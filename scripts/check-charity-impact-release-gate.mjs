#!/usr/bin/env node
import fs from 'node:fs'
const read = (p) => fs.readFileSync(p, 'utf8')
const registry = read('lib/navigation/service-registry.ts')
const route = read('app/api/ecosystem/charity/summary/route.ts')
const screen = read('components/ghc/charity-impact-screen.tsx')
const ecosystem = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const ledger = read('lib/server/earnings/platform-utility.ts')
const checks = [
  ['Charity remains Coming Soon with no live destination', /id: "charity"[\s\S]{0,220}status: "COMING_SOON"[\s\S]{0,120}destination: \{ kind: "none" \}/.test(registry)],
  ['charity summary API checks release status before auth and ledger access', route.indexOf('const access = getEcosystemServiceAccess("charity")') < route.indexOf('const auth = await resolveAuthenticatedUser') && route.indexOf('const access = getEcosystemServiceAccess("charity")') < route.indexOf('const raw = await getCharityUserSummary')],
  ['charity summary is authenticated and durably rate-limited', /resolveAuthenticatedUser/.test(route) && /checkDurableRateLimit/.test(route) && /onUnavailable: "deny"/.test(route)],
  ['summary user identity must match the authenticated session before projection', /raw as Record<string, unknown>\)\.userId !== auth\.userId/.test(route)],
  ['charity route is read-only and exposes no donation POST', /export async function GET/.test(route) && !/export async function POST/.test(route)],
  ['summary uses canonical segregated charity ledger RPC', /getCharityUserSummary\(auth\.userId\)/.test(route) && /gh_charity_user_summary/.test(ledger)],
  ['normalization returns only recorded, bounded, user-scoped contribution fields', /row\.status !== "recorded"/.test(read('lib/ecosystem/charity-impact.ts')) && /items\.slice\(0, 20\)/.test(read('lib/ecosystem/charity-impact.ts')) && !/unique_ref/.test(read('lib/ecosystem/charity-impact.ts'))],
  ['charity is explicitly segregated and non-withdrawable', /withdrawable: false/.test(read('lib/ecosystem/charity-impact.ts')) && /segregated: true/.test(read('lib/ecosystem/charity-impact.ts')) && /\.\.\.summary/.test(route)],
  ['PI amounts are formatted using exact atomic BigInt arithmetic', /BigInt\(atomic\)/.test(read('lib/ecosystem/charity-impact.ts')) && /10_000_000n/.test(read('lib/ecosystem/charity-impact.ts'))],
  ['screen has no donation or payment action', !(/onDonate|onPayment|\/api\/.*(?:donat|payment)|>\s*Donate/i.test(screen))],
  ['screen is prepared but not wired into the Coming Soon directory', /CharityImpactScreen/.test(screen) && !/CharityImpactScreen/.test(ecosystem)],
  ['screen renders only server-confirmed summary and recorded history', /payload\.durable !== true/.test(screen) && /item\.amountAtomic/.test(screen)],
  ['no new charity migration is introduced in this source increment', !fs.readdirSync('supabase/migrations').some((name) => /ecosystem_charity|charity_impact_screen/i.test(name))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Charity release-boundary checks: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
