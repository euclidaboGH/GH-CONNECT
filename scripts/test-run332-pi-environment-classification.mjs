#!/usr/bin/env node
import assert from 'node:assert/strict'
import { resolvePiPlatformEnvironment } from '../lib/server/pi/platform-capabilities.ts'

const keys = ['PI_ENV', 'PI_NETWORK', 'NEXT_PUBLIC_PI_SANDBOX', 'VERCEL_ENV']
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))

function evaluate(values) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(values, key)) process.env[key] = values[key]
    else delete process.env[key]
  }
  return resolvePiPlatformEnvironment()
}

const cases = [
  ['Pi production API mode + explicit Testnet sandbox', { PI_ENV: 'production', PI_NETWORK: 'testnet', NEXT_PUBLIC_PI_SANDBOX: 'true', VERCEL_ENV: 'preview' }, 'sandbox'],
  ['Legacy PI_ENV=testnet + explicit sandbox', { PI_ENV: 'testnet', PI_NETWORK: 'testnet', NEXT_PUBLIC_PI_SANDBOX: 'true', VERCEL_ENV: 'preview' }, 'sandbox'],
  ['Explicit Mainnet mode', { PI_ENV: 'production', PI_NETWORK: 'mainnet', NEXT_PUBLIC_PI_SANDBOX: 'false', VERCEL_ENV: 'production' }, 'production'],
  ['Explicit sandbox conflicting with Mainnet network fails closed', { PI_ENV: 'production', PI_NETWORK: 'mainnet', NEXT_PUBLIC_PI_SANDBOX: 'true', VERCEL_ENV: 'production' }, 'unknown'],
  ['Explicit mainnet sandbox switch conflicting with Testnet network fails closed', { PI_ENV: 'production', PI_NETWORK: 'testnet', NEXT_PUBLIC_PI_SANDBOX: 'false', VERCEL_ENV: 'production' }, 'unknown'],
  ['Preview defaults to sandbox when no explicit switch exists', { PI_ENV: '', PI_NETWORK: '', NEXT_PUBLIC_PI_SANDBOX: '', VERCEL_ENV: 'preview' }, 'sandbox'],
  ['Production without a known network or PI mode remains unknown', { PI_ENV: '', PI_NETWORK: '', NEXT_PUBLIC_PI_SANDBOX: '', VERCEL_ENV: '' }, 'unknown'],
]

try {
  for (const [label, values, expected] of cases) {
    const actual = evaluate(values)
    assert.equal(actual, expected, label)
    console.log(`PASS ${label}`)
  }
  console.log(`\nPi environment classification: ${cases.length}/${cases.length} passed`)
} finally {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key]
    else process.env[key] = original[key]
  }
}
