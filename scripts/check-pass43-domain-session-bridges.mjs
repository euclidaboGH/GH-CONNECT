#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read = (file) => readFileSync(join(process.cwd(), file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const context = read('contexts/ghc-context.tsx')
const seams = read('lib/domains/adapters/ghc-context-seams.ts')
const mapper = read('lib/domains/adapters/session-domain-mappers.ts')
const app = read('app/page.tsx')
const release = read('lib/app-release.ts')
const truth = read('docs/PROJECT_TRUTH.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const prebuild = pkg.scripts?.prebuild || ''
const checks = [
  ['GHC provider consumes feed domain read seam', context.includes('useFeedDomain()') && context.includes('feedDomain.bindPostsGetter')],
  ['GHC provider consumes connections domain read seam', context.includes('useConnectionsDomain()') && context.includes('connectionsDomain.bindCountsGetter')],
  ['GHC provider consumes discovery domain read seam', context.includes('useDiscoveryDomain()') && context.includes('discoveryDomain.bindCandidatesGetter')],
  ['all read seams use a current filtered session snapshot', context.includes('domainSessionRef.current = {') && context.includes('posts: visibleSession.posts') && context.includes('candidates: visibleSession.candidates')],
  ['read seam getters are reset when the GHC provider unmounts', context.includes('return () => {\n      feedDomain.bindPostsGetter(() => [])') && context.includes('discoveryDomain.bindCandidatesGetter(() => [])')],
  ['discovery candidates are filtered through global block and mute policy first', context.indexOf('applyGlobalBlockFilters({') < context.indexOf('domainSessionRef.current = {') && context.includes('candidates: visibleSession.candidates')],
  ['production discovery requires explicit server-hydrated candidates', seams.includes('!isDemoDataAllowed() && c.isSample !== false')],
  ['feed bridge excludes drafts and scheduled posts', mapper.includes('post.isDraft === true || post.isScheduled === true')],
  ['feed bridge normalizes numeric and ISO timestamps', mapper.includes('Date.parse(value)') && mapper.includes('new Date(parsed).toISOString()')],
  ['connection bridge counts incoming pending requests only', mapper.includes('from !== currentUserId && (to === currentUserId || !to)')],
  ['provider tree mounts read seams above GHC provider', app.indexOf('<FeedProvider>') < app.indexOf('<GHCProvider>') && app.indexOf('<ConnectionsProvider>') < app.indexOf('<GHCProvider>') && app.indexOf('<DiscoveryProvider>') < app.indexOf('<GHCProvider>')],
  ['runtime tests cover production/demo candidates and session counts', read('scripts/test-pass43-domain-session-bridges.mjs').includes('productionCandidates') && read('scripts/test-pass43-domain-session-bridges.mjs').includes('pendingRequestsCount')],
  ['financial write authority remains outside the new read bridge', !mapper.includes('wallet') && !mapper.includes('payment') && !mapper.includes('transfer')],
  ['package, lockfile and app release versions agree', lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['project truth and verified manifest match active version', truth.includes(`**Current source version:** \`${pkg.version}\``) && manifest.includes(`project_version=${pkg.version}`)],
  ['Pass 43 gate runs before earlier release gates', prebuild.startsWith('node scripts/check-pass43-domain-session-bridges.mjs') && prebuild.indexOf('check-pass43-domain-session-bridges') < prebuild.indexOf('check-pass42-marketplace-domain-boundary')],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`Pass 43 domain session bridges: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
