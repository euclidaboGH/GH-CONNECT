import fs from 'node:fs'
import assert from 'node:assert/strict'
const read = (p) => fs.readFileSync(p, 'utf8')
const api = read('app/api/notifications/push/subscriptions/route.ts')
const config = read('app/api/notifications/push/config/route.ts')
const server = read('lib/server/notifications/push-architecture.ts')
const sw = read('public/sw.js')
const sql = read('supabase/proposals/20261108_notification_remote_push_proposal.sql')
const contract = read('lib/notification-push-contract.ts')
const client = read('lib/notification-push-client.ts')
const checks = [
  ['subscription API derives user from authenticated session', api.includes('resolveAuthenticatedUser') && !api.includes('p_user_id: input.userId')],
  ['subscription API rate limits register/revoke/list', api.includes('checkRateLimit')],
  ['subscription endpoint validates HTTPS and encryption keys', contract.includes('url.protocol !== \"https:\"') && contract.includes('A-Za-z0-9_-]{40,256}')],
  ['endpoint ownership is bound to authenticated user', api.includes('p_user_id: auth.userId')],
  ['configuration never claims remote delivery enabled', config.includes('remoteDeliveryEnabled: false')],
  ['subscription registration fails closed until sender is implemented', api.includes('!config.senderImplemented') && api.includes('REMOTE_PUSH_NOT_ENABLED')],
  ['provider protocol is standards-based Web Push/VAPID', server.includes('web_push_vapid') && server.includes('standards_based_web_push')],
  ['sender remains explicitly disabled', server.includes('senderImplemented: false') && server.includes('ready: false')],
  ['proposal includes per-device subscriptions', sql.includes('gh_notification_push_subscriptions') && sql.includes('device_id')],
  ['proposal includes idempotent per-device outbox', sql.includes('UNIQUE(notification_id, subscription_id)')],
  ['proposal includes attempt audit records', sql.includes('gh_notification_push_attempts')],
  ['proposal claims jobs with row locks', sql.includes('FOR UPDATE OF o SKIP LOCKED')],
  ['proposal expires invalid provider endpoints', sql.includes("p_outcome='gone'") && sql.includes('PUSH_ENDPOINT_GONE')],
  ['proposal cleans up elapsed subscription expirations', sql.includes('gh_notification_push_subscriptions_cleanup_expired') && sql.includes('SUBSCRIPTION_EXPIRED')],
  ['proposal has bounded exponential retry and provider Retry-After support', sql.includes('power(2,GREATEST(v_row.attempts-1,0))') && sql.includes('21600')],
  ['proposal fails abandoned final leases closed', sql.includes('MAX_ATTEMPTS_EXHAUSTED')],
  ['endpoint validation allowlists known browser push services', contract.includes('fcm.googleapis.com') && contract.includes('push.services.mozilla.com')],
  ['proposal uses service-role-only RPC grants', sql.includes('TO service_role') && sql.includes('FROM PUBLIC,anon,authenticated')],
  ['proposal has no client table grants', sql.includes('USING (false) WITH CHECK (false)')],
  ['service worker remains a push receiver', sw.includes('self.addEventListener("push"')],
  ['client registration requires explicit gesture and enabled remote config', client.includes('remoteDeliveryEnabled !== true')],
  ['client revoke calls server before local unsubscribe', client.indexOf('if (!response.ok') < client.indexOf('await subscription.unsubscribe()')],
]
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`) }
console.log(`\n${checks.length}/${checks.length} remote push architecture contracts passed`)
