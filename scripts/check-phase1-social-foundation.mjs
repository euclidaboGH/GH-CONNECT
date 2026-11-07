#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261106090001_gh_community_post_feed_canonical.sql')
const route = read('app/api/communities/[id]/posts/route.ts')
const client = read('lib/social/client.ts')
const hub = read('components/ghc/premium-community-hub.tsx')
const card = read('components/ghc/community-canonical-post-card.tsx')
const postCard = read('components/ghc/enhanced-post-card.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['community feed is scoped by community_id and excludes deleted/archived posts', /p\.community_id\s*=\s*v_community_id/.test(migration) && /p\.deleted_at IS NULL/.test(migration) && /p\.archived_at IS NULL/.test(migration)],
  ['community feed enforces active membership and canonical post visibility', /gh_community_platform_role\(v_community_id,\s*v_viewer_id\) IS NULL/.test(migration) && /gh_post_viewer_can_read\(v_viewer_id,\s*p\.id\)/.test(migration)],
  ['community feed returns viewer-specific curation, reactions, saves and vote aggregates', /"viewerCurationChoice"/.test(migration) && /"upvoteCount"/.test(migration) && /"downvoteCount"/.test(migration) && /"viewerReactions"/.test(migration) && /"savedByMe"/.test(migration)],
  ['community feed RPC is service-role-only', /REVOKE ALL ON FUNCTION public\.gh_community_post_list\(text, text, integer, bigint, text\) FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_community_post_list\(text, text, integer, bigint, text\) TO service_role/.test(migration)],
  ['community posts API derives viewer identity from the authenticated session', /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /p_viewer_id:\s*auth\.userId/.test(route)],
  ['community posts API validates path, bounded limit and cursor input', /INVALID_COMMUNITY_ID/.test(route) && /INVALID_LIMIT/.test(route) && /INVALID_CURSOR/.test(route)],
  ['client uses the authenticated community-post endpoint', /socialListCommunityPosts/.test(client) && /\/api\/communities\//.test(client)],
  ['community hub hydrates canonical posts and listens for community refresh', /socialListCommunityPosts\(community\.id/.test(hub) && /ghc:community-refresh/.test(hub)],
  ['legacy local-only posts no longer expose fake curation or reaction controls', !/curateCommunityPost|socialSetCuration|disabled={!linked/.test(hub) && /Archived community post/.test(hub)],
  ['community canonical cards reuse the same EnhancedPostCard used by Feed/Profile', /<EnhancedPostCard/.test(card) && /CommunityCanonicalPostCard/.test(hub) && /export const EnhancedPostCard/.test(postCard)],
  ['canonical community card routes curation/reactions/save through durable APIs', /socialToggleReaction/.test(card) && /socialToggleSave/.test(card) && /onShowVisibilityReason/.test(card)],
  ['phase-one regression gate is part of prebuild and static verification', (pkg.scripts.prebuild || '').includes('check-phase1-social-foundation.mjs') && (pkg.scripts['verify:static'] || '').includes('check-phase1-social-foundation.mjs')],
]
let passed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (ok) passed++ }
console.log(`\nPhase 1 social foundation: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
