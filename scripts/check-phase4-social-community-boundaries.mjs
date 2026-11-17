#!/usr/bin/env node
/** Phase 4: social graph, visibility, and community moderation source-boundary regression checks. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const blocks = read('app/api/social/blocks/route.ts')
const follows = read('app/api/social/follows/route.ts')
const visibility = read('lib/server/social/post-visibility.ts')
const feed = read('app/api/social/feed/route.ts')
const reports = read('app/api/governance/reports/route.ts')
const moderation = read('app/api/governance/moderation-log/route.ts')
const store = read('lib/server/community/governance-store.ts')
const migration = read('supabase/migrations/20261107170001_phase7_durable_community_governance.sql')
const checks = [
  ['block writes derive actor from authenticated session', blocks.includes('resolveAuthenticatedUser(request.headers)') && blocks.includes('p_blocker_id: auth.userId')],
  ['block target uses the shared relationship sanitizer', blocks.includes('sanitizeTargetUserId(rawTargetUserId, auth.userId)') && blocks.includes('humanizeRelationshipError(targetCheck.error)')],
  ['follow writes derive actor from session and sanitize target', follows.includes('sanitizeTargetUserId(body.targetUserId, auth.userId)') && follows.includes('p_follower_id: auth.userId')],
  ['block writes fail closed when durable rate-limit control is unavailable', blocks.includes('checkDurableRateLimit') && blocks.includes('onUnavailable: "deny"')],
  ['post visibility returns unavailable instead of assuming access when policy data cannot be read', visibility.includes('return null') && visibility.includes('if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null')],
  ['feed requires canonical visibility and author identity before response', feed.includes('filterVisibleSocialPosts(auth.userId, posts)') && feed.includes('POST_VISIBILITY_UNAVAILABLE') && feed.includes('FEED_AUTHOR_ID_UNAVAILABLE')],
  ['moderation and report reads require moderator role', reports.includes('await requireCommunityModerator(communityId, auth)') && moderation.includes('await requireCommunityModerator(communityId, auth)')],
  ['moderation append rechecks role in database RPC and restricts execution', migration.includes('v_role := public.gh_community_platform_role(p_community_id, p_actor_id)') && migration.includes('TO service_role') && migration.includes('FROM PUBLIC, anon, authenticated')],
  ['moderation writes use the authenticated actor ID', reports.includes('actorId: auth.userId') && moderation.includes('actorId: auth.userId')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
assert.equal(failed, 0, `${failed} Phase 4 social/community boundary checks failed`)
console.log(`Phase 4 social/community boundary checks: ${checks.length}/${checks.length} passed`)
