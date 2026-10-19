import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const rewards = read('components/ghc/daily-reward-experience.tsx')
const bell = read('components/ghc/notification-bell.tsx')
const app = read('components/ghc/app.tsx')
const release = read('lib/app-release.ts')
const packageJson = JSON.parse(read('package.json'))
const postApi = read('app/api/social/posts/route.ts')
const messageApi = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const postMigration = read('supabase/migrations/202610240007_gh_post_created_notifications.sql')

const checks = [
  ['Daily reward is compact in the header, not a persistent feed card', /useDailyClaimStatus/.test(feed) && /Daily reward status is kept compact in the app header/.test(feed) && !/data-ghc-feed-daily-reward/.test(feed)],
  ['Claim-ready attention notice is deduplicated per user and reward day', /daily-reward-ready-notice/.test(feed) && /Your daily GHC reward is ready to claim/.test(feed) && /ghc:open-rewards/.test(feed)],
  ['Reward remains visible while server status hydrates', /Until the server confirms\s+\/\/ today's status, keep the claim visible/.test(rewards) && /canClaimToday: true/.test(rewards)],
  ['Daily claim remains server-authoritative', /fetch\("\/api\/economy\/rewards\/daily"/.test(rewards)],
  ['Notification center loads durable social activity', /api\/social\/notifications\?limit=60/.test(bell)],
  ['Notification center loads durable GHC/economy alerts', /api\/economy\/notifications\?limit=60/.test(bell)],
  ['Notification center combines local, social, economy, and system-announcement unread counts', /setUnread\(localUnread \+ socialUnread \+ economyUnread \+ announcementUnread\)/.test(bell)],
  ['Durable social alerts can be marked read', /action: "mark_read"/.test(bell)],
  ['Durable economy alerts can be marked read', /api\/economy\/notifications\/\$\{encodeURIComponent\(n\.id\)\}\/read/.test(bell)],
  ['Navigation refreshes attention counts from server endpoints', /api\/social\/notifications\?countOnly=1/.test(app) && /api\/economy\/notifications\/unread-count/.test(app)],
  ['Home, messages, discovery and profile have attention dots', /id === "home" && \(socialAttentionCount/.test(app) && /id === "messages" && unreadMessageCount/.test(app) && /id === "discover" && connectionRequestBadge/.test(app) && /id === "profile" && \(economyAttentionCount/.test(app)],
  ['Navigation responds to read and new-activity events', /ghc:notifications-read/.test(app) && /ghc:new-message/.test(app) && /ghc:post-engagement/.test(app)],
  ['New app releases create a reviewable system notification', /GreenHaven has been updated/.test(app) && /ghc:last-seen-release/.test(app) && /dedupeKey: `app-release:/.test(app)],
  ['Release notice version matches package version', new RegExp(`APP_RELEASE_VERSION = \"${packageJson.version.replaceAll('.', '\\.')}\"`).test(release)],
  ['Published posts notify eligible followers through a server RPC', /gh_social_notify_post_followers/.test(postApi) && /gh_social_notify_post_followers/.test(postMigration)],
  ['Post notification migration allows post_created and protects RPC access', /'post_created'/.test(postMigration) && /GRANT EXECUTE.*service_role/.test(postMigration) && /REVOKE ALL.*FROM PUBLIC/.test(postMigration)],
  ['Durable messages notify conversation members after server acceptance', /gh_social_notify_message_members/.test(messageApi) && /!result.idempotent/.test(messageApi) && /gh_social_notify_message_members/.test(postMigration) && /category', 'messages'/.test(postMigration)],
]

let failed = 0
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
  if (!passed) failed++
}
console.log(`notification-attention: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
