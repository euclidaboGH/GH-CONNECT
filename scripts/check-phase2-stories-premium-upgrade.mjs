#!/usr/bin/env node
import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(path, 'utf8')
const component = read('components/ghc/profile-story-section.tsx')
const context = read('contexts/ghc-context.tsx')
const types = read('lib/ghc-types.ts')
const sanitize = read('lib/ghc-data.ts')
const migration = read('supabase/migrations/20261106130001_gh_story_view_privacy_and_read_performance.sql')
const viewRoute = read('app/api/social/stories/[id]/view/route.ts')
const listRoute = read('app/api/social/stories/route.ts')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const checks = [
  ['story tray groups multiple stories by creator', component.includes('otherStoryGroups') && component.includes('group.push(story)')],
  ['creator story sequences play chronologically', component.includes('group.sort((a, b) => a.createdAt - b.createdAt)') && component.includes('const queue = [...ownStories, ...otherStoryGroups.flat()]')],
  ['creator story cards expose sequence counts without duplicating creator tiles', component.includes('group.length > 1') && component.includes('ownStories.length > 1')],
  ['audience copy explains the effective everyone/block boundary', component.includes('All members, except accounts you block')],
  ['own story tray opens the first unseen story', component.includes('ownStories.find((story) => !isStorySeen(story))')],
  ['archived, draft and expired stories are excluded from the active rail', component.includes('["archived", "draft", "expired"].includes(String(story.status || ""))')],
  ['seen state is account-scoped rather than shared across browser accounts', component.includes('ghc-story-seen:${profile.id || "current-user"}') && component.includes('ghc-story-highlights:${profile.id || "current-user"}')],
  ['server-confirmed seen state is persisted before local seen state', component.includes('if (!result.ok || !result.durable) return') && component.includes('window.localStorage.setItem(seenStorageKey')],
  ['story autoplay supports pause and resume', component.includes('viewerPaused') && component.includes('setViewerPaused((paused) => !paused)')],
  ['story autoplay respects reduced motion', component.includes('prefersReducedMotion()')],
  ['video story advances on media completion', component.includes('onEnded={() => navigateStory(1)}')],
  ['story creator has one close control', (component.match(/aria-label="Close story creator"/g) || []).length === 1],
  ['story view state is included in the canonical type and sanitizer', types.includes('viewerHasViewed?: boolean') && sanitize.includes('viewerHasViewed: raw.viewerHasViewed === true')],
  ['durable story hydration preserves seen and reaction state', context.includes('viewerHasViewed: st.viewerHasViewed === true') && context.includes('viewerReactions: Array.isArray(st.viewerReactions)')],
  ['successful durable empty story response clears stale local stories', context.includes('stories?.ok && stories.durable && Array.isArray(stories.stories)')],
  ['story view endpoint is rate limited', viewRoute.includes('checkRateLimit') && viewRoute.includes('story-view:${auth.userId}')],
  ['direct story views enforce audience permissions', migration.includes("v_audience = 'followers'") && migration.includes("v_audience = 'friends'") && migration.includes('private and matches-only intentionally fail closed')],
  ['blocked relationships cannot record story views', migration.includes('FROM public.ghc_user_blocks b') && migration.includes("'NOT_AVAILABLE'")],
  ['story list RPC is read-only and returns viewer seen state', !/UPDATE\s+public\.gh_stories/i.test(migration) && migration.includes('"viewerHasViewed"')],
  ['story view recording remains idempotent and excludes owner self-views', migration.includes('ON CONFLICT (story_id, viewer_id) DO NOTHING') && migration.includes('IF v_owner <> p_viewer_id')],
  ['viewer lookup index supports per-viewer hydration', migration.includes('idx_gh_story_views_viewer_story')],
  ['story list preserves server audience and block filters', listRoute.includes('gh_story_list_active') && listRoute.includes('Cache-Control')],
  ['story reactions use the canonical SQL aggregate with a bounded pre-migration compatibility fallback', migration.includes('AS \"reactionCounts\"') && migration.includes('AS \"viewerReactions\"') && migration.includes('AS \"reactionCount\"') && listRoute.includes('story.reactionCounts') && listRoute.includes('socialRest')],
  ['new story-view RPC is versioned and fails closed before the migration is deployed', viewRoute.includes('gh_story_view_authorized_v2') && migration.includes('CREATE OR REPLACE FUNCTION public.gh_story_view_authorized_v2') && migration.includes('REVOKE ALL ON FUNCTION public.gh_story_view(text, text) FROM service_role')],
  ['Phase 2 migration remains held for review', read('MIGRATION-SOURCE-MANIFEST.csv').includes('20261106130001_gh_story_view_privacy_and_read_performance.sql,REVIEW_REQUIRED,')],
  ['migration ACLs remain service-role only', migration.includes('REVOKE ALL ON FUNCTION public.gh_story_view(text, text) FROM service_role') && migration.includes('GRANT EXECUTE ON FUNCTION public.gh_story_view_authorized_v2(text, text) TO service_role') && viewRoute.includes('gh_story_view_authorized_v2')],
  ['package and lockfile release metadata agree', /^\d+\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages[''].version === pkg.version],
  ['release and static verification include Phase 2 story contract', read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && pkg.scripts.prebuild.includes('check-phase2-stories-premium-upgrade') && pkg.scripts['verify:static'].includes('check-phase2-stories-premium-upgrade')],
]
for (const [name, passed] of checks) {
  assert.equal(passed, true, name)
  console.log(`PASS ${name}`)
}
console.log(`Phase 2 Stories premium upgrade: ${checks.length}/${checks.length} passed`)
