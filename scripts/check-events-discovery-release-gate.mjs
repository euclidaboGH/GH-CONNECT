#!/usr/bin/env node
import fs from 'node:fs'
const read = (p) => fs.readFileSync(p, 'utf8')
const registry = read('lib/navigation/service-registry.ts')
const nav = read('lib/navigation/navigate.ts')
const gate = read('lib/server/ecosystem/service-release.ts')
const route = read('app/api/ecosystem/events/route.ts')
const screen = read('components/ghc/events-discovery-screen.tsx')
const communityScreen = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const platformRoute = read('app/api/communities/[id]/platform/route.ts')
const checks = [
  ['Events remains Coming Soon with no live destination', /id: "events"[\s\S]{0,220}status: "COMING_SOON"[\s\S]{0,120}destination: \{ kind: "none" \}/.test(registry)],
  ['server gate uses canonical registry status', /getServiceById\(id\)/.test(gate) && /isInteractiveStatus\(service\.status\)/.test(gate)],
  ['Coming Soon and unavailable services fail closed on server', /SERVICE_NOT_RELEASED/.test(gate) && /SERVICE_UNAVAILABLE/.test(gate)],
  ['Events API checks release status before authentication or data access', route.indexOf('const access = getEcosystemServiceAccess("events")') < route.indexOf('const auth = await resolveAuthenticatedUser') && route.indexOf('const access = getEcosystemServiceAccess("events")') < route.indexOf('const eventResult = await socialRest<')],
  ['Events API requires authenticated viewer and durable read throttling', /resolveAuthenticatedUser/.test(route) && /checkDurableRateLimit/.test(route) && /onUnavailable: "deny"/.test(route)],
  ['Events API uses server-side service-role reads only', /socialRest<RawCommunityEvent\[]>/.test(route) && /socialRest<RawCommunity\[]>/.test(route) && !/fetch\(.*rest\/v1/.test(route)],
  ['private and invite-only events are filtered by active membership', /community\.privacy !== "public" && !activeMemberships\.has\(communityId\)/.test(read('lib/ecosystem/events-discovery.ts'))],
  ['deleted communities and invalid/ended events are excluded', /community\.deleted_at != null/.test(read('lib/ecosystem/events-discovery.ts')) && /endsAt <= now/.test(read('lib/ecosystem/events-discovery.ts'))],
  ['event projection omits creator IDs and attendance rosters', !/creator_id|attendeeIds|memberRoster/.test(screen)],
  ['RSVP writes reuse the canonical authenticated community platform route', /\/api\/communities\/\$\{encodeURIComponent\(event\.communityId\)\}\/platform/.test(screen) && /action: "event_rsvp"/.test(screen) && /durable !== true/.test(screen)],
  ['Community event create and RSVP path remains intact', /gh_community_event_create/.test(platformRoute) && /gh_community_event_rsvp/.test(platformRoute)],
  ['Events discovery UI is prepared but not wired into the Coming Soon directory', !/EventsDiscoveryScreen/.test(communityScreen)],
  ['Events screen aborts stale search and pagination requests on filter changes', /new AbortController\(\)/.test(screen) && /requestRef\.current\?\.abort\(\)/.test(screen) && /signal\?\.aborted/.test(screen)],
  ['service navigation continues to reject non-interactive statuses', /if \(!isInteractiveStatus\(service\.status\)\) return false/.test(nav)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Events release-boundary checks: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
