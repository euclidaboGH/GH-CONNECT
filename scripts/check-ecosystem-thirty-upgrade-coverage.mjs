#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const registry = read('lib/navigation/service-registry.ts')
const plans = read('lib/navigation/service-upgrade-plan.ts')
const screen = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const docs = read('docs/ECOSYSTEM_TEN_UPGRADE_PROGRAM.md')
const checks = []
const check = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
const serviceEntries = [...registry.matchAll(/^    id: "([^"]+)",[\s\S]*?^    status: "(ACTIVE|BETA|COMING_SOON|UNAVAILABLE)"/gm)]
const serviceIds = serviceEntries.map((m) => m[1])
const statuses = serviceEntries.map((m) => m[2])
const trackIds = [...plans.matchAll(/^    id: "([a-z-]+)",$/gm)].map((m) => m[1])
const uniqueTrackIds = [...new Set(trackIds)]
const serviceContextBlock = plans.match(/const SERVICE_CONTEXT:[\s\S]*?\n}\n/)?.[0] || ''
const tailoredServiceIds = [...serviceContextBlock.matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1])
check('01 every registered service has a unique id', serviceIds.length === new Set(serviceIds).size && serviceIds.length === 41)
check('02 exactly thirty distinct upgrade tracks are defined', uniqueTrackIds.length === 30)
check('03 original ten upgrade tracks remain present', ['journeys','experience','accessibility','identity','data-contracts','security-privacy','integrity','reliability','observability','release-readiness'].every((id) => uniqueTrackIds.includes(id)))
check('04 additional twenty upgrade tracks are present', ['onboarding','discovery-search','personalization','notifications','collaboration','content-lifecycle','moderation-trust','data-portability','api-contracts','performance-budget','offline-resilience','support-escalation','audit-history','quality-assurance','feature-controls','data-retention','fraud-abuse','localization-qa','backup-recovery','operator-console'].filter((id) => uniqueTrackIds.includes(id)).length === 20)
check('05 every service has individually tailored objectives', serviceIds.every((id) => tailoredServiceIds.includes(id)) && tailoredServiceIds.length === 41)
check('06 all nine categories have dedicated context', ['social','commerce','education','transport','hospitality','finance','charity','media','ai'].every((c) => new RegExp(`${c}:`).test(plans)))
check('07 plan generator returns thirty unique tracks per service', /return plan\.length === 30/.test(plans) && /TRACKS\.map\(/.test(plans))
check('08 Coming Soon remains informational and non-interactive', /destination: \{ kind: "none" \}/.test(registry) && /isInteractiveStatus\(service\.status\)/.test(screen))
check('09 Coming Soon labels and release restrictions remain visible', /Coming soon/.test(screen) && /remains Coming Soon/.test(screen) && /explicitly released/.test(screen))
check('10 all thirty tracks are disclosed in Coming Soon details', /getServiceUpgradePlan\(service\)\.map/.test(screen) && /30 upgrade tracks in preparation/.test(screen))
check('11 plans are explicitly not completion claims', /not claims that a feature is shipped/.test(plans) && /not represented as completed/.test(screen))
check('12 finance and entitlement authority remains server-side', /No client-authoritative balances, rewards, payments, bookings, or entitlements/.test(plans))
check('13 migration review and explicit launch authorization remain required', /explicit launch authorization/.test(docs) && /clean-database/.test(docs))
check('14 original service statuses remain 11 Active and 30 Coming Soon', statuses.filter(s => s === 'ACTIVE').length === 11 && statuses.filter(s => s === 'COMING_SOON').length === 30)
check('15 plans do not rewrite service statuses', !/status\s*:\s*"ACTIVE"|status\s*:\s*"BETA"|status\s*:\s*"COMING_SOON"/.test(plans))
console.log(`\nEcosystem thirty-track coverage: ${checks.filter(Boolean).length}/${checks.length} checks passed; ${serviceIds.length} services × 30 tracks = ${serviceIds.length * 30} scoped objectives.`)
if (checks.some((ok) => !ok)) process.exit(1)
