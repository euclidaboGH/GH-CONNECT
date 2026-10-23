import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const checks = []
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail })
}
function includes(file, needle) {
  return read(file).includes(needle)
}
function noIncludes(file, needle) {
  return !read(file).includes(needle)
}

// 1–10: Test infrastructure and canonical authority boundaries.
check('phase39 convergence audit remains wired', includes('package.json', 'audit:phase39-backend-convergence'))
check('phase40 fortress test is present', exists('scripts/test-phase40-regression-fortress.mjs'))
check('CI includes phase40 fortress', includes('package.json', 'test:phase40-regression-fortress'))
check('canonical daily claim client boundary exists', exists('lib/rewards/claim-daily-client.ts'))
check('daily claim status coordinator exists', exists('lib/rewards/daily-claim-status-store.ts'))
check('daily claim hook uses shared coordinator', includes('components/ghc/use-daily-claim-status.ts', 'subscribeDailyClaimStatus'))
check('daily claim POST remains canonical', includes('lib/rewards/claim-daily-client.ts', '/api/economy/rewards/daily'))
check('daily claim sends no client amount', noIncludes('lib/rewards/claim-daily-client.ts', 'amount:'))
check('daily claim server authority remains documented', includes('lib/rewards/claim-daily-client.ts', 'server/database is authoritative'))
check('phase39 authority registry remains present', exists('lib/server/platform/backend-authority.ts'))

// 11–20: Social, feed, comments, curation and identity contracts.
check('canonical feed RPC contract present', includes('scripts/audit-phase39-backend-convergence.mjs', 'gh_post_list_feed_v3'))
check('canonical comment RPC contract present', includes('scripts/audit-phase39-backend-convergence.mjs', 'gh_comment_list_v3'))
check('curation atomic contract present', includes('scripts/audit-phase39-backend-convergence.mjs', 'gh_post_curation_set_with_reward'))
check('social post visibility is server-authoritative', exists('lib/server/social/post-visibility.ts'))
check('profile server route exists', exists('app/api/social/profile/[userId]/route.ts'))
check('post direct GET route exists', exists('app/api/social/posts/[id]/route.ts'))
check('comment focus cross-surface contract exists', includes('components/ghc/comment-sheet.tsx', 'ghc:focus-comment'))
check('post sync contract exists', includes('lib/social/post-sync.ts', 'ghc:post-sync'))
check('feed stale-response protection exists', includes('contexts/ghc-context.tsx', 'feedRequestRef') && includes('contexts/ghc-context.tsx', 'STALE_FEED_RESPONSE'))
check('reputation intelligence server boundary exists', exists('lib/server/reputation/intelligence.ts'))

// 21–30: Economy, payments, membership, marketplace.
check('wallet economy server API exists', exists('app/api/economy'))
check('daily claim canonical endpoint exists', exists('app/api/economy/rewards/daily/route.ts'))
check('redemption endpoint exists', exists('app/api/economy/rewards/claim/route.ts'))
check('membership status API exists', exists('app/api/membership/status/route.ts'))
check('payment completion route exists', exists('app/api/payments/complete/route.ts'))
check('payment fulfillment route exists', exists('app/api/payments/fulfill/route.ts'))
check('marketplace commerce route exists', exists('app/api/marketplace/orders/[orderId]/commerce/route.ts'))
check('marketplace order server store exists', exists('lib/server/marketplace/order-store.ts'))
check('creator economy server summary exists', includes('lib/server/creator/store.ts', 'getCreatorEconomySummary'))
check('activity attribution infrastructure exists', exists('lib/server/economy/activity-emission.ts') || exists('lib/server/economy/correlation.ts'))

// 31–40: Messaging, notification, community, media, security.
check('messaging V2 migration exists', exists('supabase/migrations/20261023010003_gh_messaging_v2.sql'))
check('unified notifications server exists', exists('lib/server/notifications/unified.ts'))
check('notification API exists', exists('app/api/notifications/route.ts'))
check('realtime recovery exists', exists('lib/realtime/recovery.ts'))
check('community platform V2 migration exists', exists('supabase/migrations/20261023030001_gh_community_platform_v2.sql'))
check('reputation intelligence migration exists', exists('supabase/migrations/20261023030002_gh_reputation_curation_intelligence_v2.sql'))
check('media upload authorization exists', includes('app/api/media/direct-upload-intent/route.ts', 'uploadId') || exists('lib/server/media'))
check('security event infrastructure exists', exists('lib/server/security'))
check('Pi payment backend lock exists', exists('scripts/verify-pi-backend-lock.mjs'))
check('notification deep-link contract exists', includes('lib/notification-center.ts', 'commentId'))

// 41–50: Race conditions, duplicated polling, release gates.
check('daily status no longer owns a polling interval per hook', noIncludes('components/ghc/use-daily-claim-status.ts', 'setInterval'))
check('daily status store owns the shared polling interval', includes('lib/rewards/daily-claim-status-store.ts', 'setInterval'))
check('daily status requests are single-flight', includes('lib/rewards/daily-claim-status-store.ts', 'inFlight'))
check('daily status ignores stale responses', includes('lib/rewards/daily-claim-status-store.ts', 'requestVersion'))
check('daily status reacts to claim events', includes('lib/rewards/daily-claim-status-store.ts', 'ghc:daily-reward-claimed'))
check('daily status reacts to reconnect', includes('lib/rewards/daily-claim-status-store.ts', 'online'))
check('daily status reacts to visibility', includes('lib/rewards/daily-claim-status-store.ts', 'visibilitychange'))
check('daily claim UI remains fixed out of layout flow', includes('components/ghc/daily-claim-prompt.tsx', 'fixed bottom-'))
check('production build remains the final release gate', includes('package.json', '&& npm run build &&'))
check('migration release readiness remains wired', includes('package.json', 'check:migration-release-readiness'))

const failed = checks.filter((x) => !x.ok)
for (const [i, item] of checks.entries()) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${String(i + 1).padStart(2, '0')}. ${item.name}${item.detail ? ` — ${item.detail}` : ''}`)
}
console.log(`\nPHASE 40 REGRESSION FORTRESS: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
