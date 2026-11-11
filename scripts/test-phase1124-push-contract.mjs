import assert from 'node:assert/strict'
import {
  hashPushEndpoint, normalizePushCategoryPreferences, normalizePushDeviceId,
  normalizePushEndpoint, validatePushSubscription,
} from '../lib/notification-push-contract.ts'

let passed = 0
function check(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`) }
check('accepts HTTPS endpoint', () => assert.equal(normalizePushEndpoint('https://fcm.googleapis.com/send/abc'), 'https://fcm.googleapis.com/send/abc'))
check('rejects HTTP endpoint', () => assert.equal(normalizePushEndpoint('http://push.example.test/send'), null))
check('rejects localhost endpoint', () => assert.equal(normalizePushEndpoint('https://localhost/send'), null))
check('rejects endpoint credentials', () => assert.equal(normalizePushEndpoint('https://user:pass@fcm.googleapis.com/send'), null))
check('rejects endpoint fragment', () => assert.equal(normalizePushEndpoint('https://fcm.googleapis.com/send#x'), null))
check('rejects oversized endpoint', () => assert.equal(normalizePushEndpoint(`https://fcm.googleapis.com/${'a'.repeat(4100)}`), null))
check('validates subscription key lengths', () => assert.ok(validatePushSubscription({ endpoint: 'https://fcm.googleapis.com/send', keys: { p256dh: 'A'.repeat(65), auth: 'a'.repeat(24) } })))
check('rejects missing subscription keys', () => assert.equal(validatePushSubscription({ endpoint: 'https://fcm.googleapis.com/send', keys: {} }), null))
check('normalizes expiration timestamp', () => assert.equal(validatePushSubscription({ endpoint: 'https://fcm.googleapis.com/send', keys: { p256dh: 'A'.repeat(65), auth: 'a'.repeat(24) }, expirationTime: 1234.9 }).expirationTime, 1234))
check('hashes endpoints deterministically', () => assert.equal(hashPushEndpoint('https://fcm.googleapis.com/send'), hashPushEndpoint('https://fcm.googleapis.com/send')))
check('endpoint hash is SHA-256 hex', () => assert.match(hashPushEndpoint('https://fcm.googleapis.com/send'), /^[a-f0-9]{64}$/))
check('accepts device id contract', () => assert.equal(normalizePushDeviceId('a'.repeat(32)), 'a'.repeat(32)))
check('rejects short device id', () => assert.equal(normalizePushDeviceId('short'), null))
check('accepts category preferences', () => assert.deepEqual(normalizePushCategoryPreferences({ messages: true, wallet: false }), { messages: true, wallet: false }))
check('rejects unknown category', () => assert.equal(normalizePushCategoryPreferences({ admin: true }), null))
check('rejects non-boolean category preference', () => assert.equal(normalizePushCategoryPreferences({ messages: 'yes' }), null))
check('rejects array category preferences', () => assert.equal(normalizePushCategoryPreferences([]), null))
check('rejects unknown push-service host', () => assert.equal(normalizePushEndpoint('https://push.example.test/send'), null))
check('rejects non-base64url encryption key material', () => assert.equal(validatePushSubscription({ endpoint: 'https://fcm.googleapis.com/send', keys: { p256dh: '!'.repeat(65), auth: 'a'.repeat(24) } }), null))
console.log(`\n${passed}/19 push contract tests passed`)
