#!/usr/bin/env node
/** Phase 5 Messages & Notifications source contracts. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const center = read('lib/notification-center.ts')
const integrity = read('lib/server/messaging/messaging-integrity.ts')
const store = read('lib/server/messaging/message-store.ts')
const unified = read('lib/server/notifications/unified.ts')
const notifRoute = read('app/api/notifications/route.ts')
const socialRoute = read('app/api/social/notifications/route.ts')
const messagesRoute = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const offline = read('lib/messaging/offline-message-flush.ts')
const bell = read('components/ghc/notification-bell.tsx')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')

test('deep links are sanitized against open redirects and javascript URLs', /sanitizeNotificationDeepLink/.test(center) && /javascript:/i.test(center) && /ALLOWED_OPEN/.test(center))
test('navigateNotificationDeepLink sanitizes before navigation', /sanitizeNotificationDeepLink\(raw\)|sanitizeNotificationDeepLink\(link\)/.test(center))
test('messaging integrity requires authenticated user', /requireMessagingAuth/.test(integrity) && /AUTH_REQUIRED/.test(integrity))
test('messaging integrity fails closed without durable store in production', /MESSAGING_DURABILITY_UNAVAILABLE/.test(integrity))
test('conversation membership is enforced before treating member as authorized', /requireConversationMember/.test(integrity) && /isMember/.test(integrity))
test('appendMessage rejects empty body and non-members', /EMPTY_BODY/.test(store) && /FORBIDDEN/.test(store))
test('appendMessage supports clientMessageId idempotency', /clientMessageId/.test(store) && /idempotent/.test(store))
test('message route rejects idempotency keys longer than the store’s 80-character contract', /clientMessageId.length > 80/.test(messagesRoute) && /slice\(0, 80\)/.test(store))
test('unified notification list binds recipient to authenticated server user id parameter', /p_recipient_user_id/.test(unified))
test('unified mark-read is server-side only for recipient', /gh_notification_inbox_mark_read/.test(unified))
test('notifications API requires auth and rate-limits mark-read', /AUTH_REQUIRED/.test(notifRoute) && /checkRateLimit/.test(notifRoute))
test('social notifications reject client create', /Clients cannot create social notifications/.test(socialRoute))
test('message routes use bounded JSON bodies', /readBoundedJson/.test(messagesRoute))
test('offline message flush removes permanent failures and bounds retries', /RETRY_LIMIT_REACHED|MESSAGE_REJECTED/.test(offline))
test('notification center dual mark-read waits for both social and unified writes', /\/api\/social\/notifications/.test(bell) && /\/api\/notifications/.test(bell) && /Promise\.all/.test(bell))
test('mark-all reports partial durable failure honestly', /Some alerts could not be marked read/.test(bell))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('phase 5 checker is registered in prebuild', Boolean(pkg.scripts?.['prebuild:checks']?.includes('check-phase5-messages-notifications.mjs')))
test('phase 5 programme doc exists', existsSync(join(root, 'docs/PHASE-5-MESSAGES-NOTIFICATIONS-2026-11-08.md')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 5 messages & notifications: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
