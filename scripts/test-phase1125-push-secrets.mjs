import assert from 'node:assert/strict'
import { generateKeyPairSync, createECDH } from 'node:crypto'
import { encryptPushSecret, decryptPushSecret, validateVapidConfiguration } from '../lib/server/notifications/push-secrets.ts'

const encryptionKey = Buffer.alloc(32, 7).toString('base64url')
process.env.WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY = encryptionKey
const plaintexts = [
  'https://fcm.googleapis.com/fcm/send/example-token',
  'p256dh-public-key-material',
  'auth-secret-material',
]
for (const plaintext of plaintexts) {
  const envelope = encryptPushSecret(plaintext)
  assert.notEqual(envelope, plaintext)
  assert.equal(decryptPushSecret(envelope), plaintext)
  const parts = envelope.split('.')
  const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${Buffer.from('tampered').toString('base64url')}`
  assert.throws(() => decryptPushSecret(tampered))
}

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = privateKey.export({ format: 'jwk' })
const privateBytes = Buffer.from(jwk.d, 'base64url')
const ecdh = createECDH('prime256v1')
ecdh.setPrivateKey(privateBytes)
const publicKey = ecdh.getPublicKey(undefined, 'uncompressed').toString('base64url')
const privateKeyValue = privateBytes.toString('base64url')
const subject = 'mailto:push@greenhaven.example'
assert.deepEqual(validateVapidConfiguration(publicKey, privateKeyValue, subject), {
  valid: true, publicKey, reason: null,
})
const wrongPair = Buffer.alloc(32, 9).toString('base64url')
assert.equal(validateVapidConfiguration(publicKey, wrongPair, subject).reason, 'VAPID_KEYPAIR_MISMATCH')
assert.equal(validateVapidConfiguration(publicKey, privateKeyValue, 'javascript:alert(1)').valid, false)
assert.equal(validateVapidConfiguration('bad', privateKeyValue, subject).valid, false)

console.log('PASS AES-256-GCM round-trip and authenticated tamper rejection')
console.log('PASS VAPID P-256 public/private keypair verification')
console.log('PASS invalid VAPID subject and malformed keys rejected')
console.log('3/3 Phase 11.2.5 push secret tests passed')
