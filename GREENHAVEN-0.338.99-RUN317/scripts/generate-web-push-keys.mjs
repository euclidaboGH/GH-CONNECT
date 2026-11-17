#!/usr/bin/env node
import { generateKeyPairSync, randomBytes } from 'node:crypto'

// Run only in a trusted operator terminal. This intentionally prints secrets once
// so they can be entered directly into the deployment platform's secret manager.
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = privateKey.export({ format: 'jwk' })
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url'),
]).toString('base64url')
const privateKeyValue = Buffer.from(jwk.d, 'base64url').toString('base64url')
const encryptionKey = randomBytes(32).toString('base64url')

console.log('# Add these values to the deployment secret manager; do not commit them.')
console.log(`WEB_PUSH_VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`WEB_PUSH_VAPID_PRIVATE_KEY=${privateKeyValue}`)
console.log('WEB_PUSH_VAPID_SUBJECT=mailto:YOUR-REAL-PUSH-CONTACT@YOUR-DOMAIN')
console.log(`WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY=${encryptionKey}`)
console.log('# Store the private key and encryption key as server-only secrets.')
