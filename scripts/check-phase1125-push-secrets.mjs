import fs from 'node:fs'
import assert from 'node:assert/strict'
const read = (path) => fs.readFileSync(path, 'utf8')
const sql = read('supabase/proposals/20261108_notification_remote_push_proposal.sql')
const route = read('app/api/notifications/push/subscriptions/route.ts')
const secrets = read('lib/server/notifications/push-secrets.ts')
const server = read('lib/server/notifications/push-architecture.ts')
const sw = read('public/sw.js')
const checks = [
  ['subscription endpoint and keys are stored as ciphertext columns', /endpoint_ciphertext text NOT NULL/.test(sql) && /p256dh_ciphertext text NOT NULL/.test(sql) && /auth_ciphertext text NOT NULL/.test(sql)],
  ['proposal no longer stores plaintext endpoint or subscription keys', !/\bendpoint text NOT NULL/.test(sql) && !/\bp256dh text NOT NULL/.test(sql) && !/\bauth_secret text NOT NULL/.test(sql)],
  ['application encrypts all subscription secrets before RPC storage', route.includes('encryptPushSecret(subscription.endpoint)') && route.includes('encryptPushSecret(subscription.p256dh)') && route.includes('encryptPushSecret(subscription.auth)')],
  ['AES-256-GCM binds ciphertext to GreenHaven subscription purpose', secrets.includes('aes-256-gcm') && secrets.includes('setAAD(ENCRYPTION_AAD)')],
  ['ciphertext envelope authenticates before returning plaintext', secrets.includes('decipher.setAuthTag(tag)')],
  ['VAPID private scalar derives and verifies supplied P-256 public key', secrets.includes('createECDH("prime256v1")') && secrets.includes('VAPID_KEYPAIR_MISMATCH')],
  ['invalid VAPID subjects are rejected', secrets.includes('url.protocol === "https:"') && secrets.includes('mailto:')],
  ['configuration requires valid VAPID pair and encryption key', server.includes('vapid.valid') && server.includes('encryptionConfigured')],
  ['claim RPC returns ciphertext only and distinguishes provider acceptance from device delivery', sql.includes("'endpointCiphertext',s.endpoint_ciphertext") && !sql.includes("'endpoint',s.endpoint") && !sql.includes("'p256dh',s.p256dh") && sql.includes("status IN ('pending','processing','accepted','failed','expired')") && sql.includes('provider_accepted_at')],
  ['claim RPC uses generic privacy-safe notification payload with opaque tag', sql.includes("'body','You have a new notification.'") && sql.includes("'tag','ghn:' || md5(n.id)") && !sql.includes("'body',n.body") && !sql.includes("'title',n.title")],
  ['service worker ignores remote payload content for privacy', sw.includes('const title = "GreenHaven"') && sw.includes('body: "You have a new notification"') && sw.includes('data: { url: "/" }') && sw.includes('/^ghn:[a-f0-9]{32}$/')],
  ['remote sender remains disabled until vetted dependency and worker acceptance', server.includes('senderImplemented: false') && server.includes('ready: false')],
]
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`) }
console.log(`${checks.length}/${checks.length} Phase 11.2.5 push secret contracts passed`)
