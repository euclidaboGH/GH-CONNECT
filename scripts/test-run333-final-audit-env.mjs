#!/usr/bin/env node
import assert from 'node:assert/strict'
import { evaluateFinalReleaseAudit } from '../lib/server/release/final-audit.ts'
import { APP_RELEASE_VERSION } from '../lib/app-release.ts'

const keys = ['PI_ENV', 'PI_NETWORK', 'NEXT_PUBLIC_PI_SANDBOX', 'VERCEL_ENV', 'NODE_ENV']
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
function evaluate(values) {
  for (const key of keys) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key]
    else delete process.env[key]
  }
  return evaluateFinalReleaseAudit()
}
try {
  const testnet = evaluate({ PI_ENV: 'production', PI_NETWORK: 'testnet', NEXT_PUBLIC_PI_SANDBOX: 'true', VERCEL_ENV: 'preview' })
  assert.equal(testnet.releaseVersion, APP_RELEASE_VERSION)
  assert.equal(testnet.checks.find((item) => item.id === 'mainnet-separation')?.status, 'verified')
  assert.match(testnet.checks.find((item) => item.id === 'mainnet-separation')?.evidence || '', /PI_NETWORK=testnet/)
  console.log('PASS Pi API production mode with Testnet blockchain is classified as Testnet-safe')

  const mainnet = evaluate({ PI_ENV: 'production', PI_NETWORK: 'mainnet', NEXT_PUBLIC_PI_SANDBOX: 'false', VERCEL_ENV: 'production' })
  assert.equal(mainnet.checks.find((item) => item.id === 'mainnet-separation')?.status, 'operator_required')
  console.log('PASS Mainnet blockchain target requires explicit operator review')

  const unknown = evaluate({ PI_ENV: 'production', PI_NETWORK: '', NEXT_PUBLIC_PI_SANDBOX: '', VERCEL_ENV: 'production' })
  assert.equal(unknown.checks.find((item) => item.id === 'mainnet-separation')?.status, 'operator_required')
  console.log('PASS Unknown blockchain network fails closed')

  const sandboxConflict = evaluate({ PI_ENV: 'production', PI_NETWORK: 'mainnet', NEXT_PUBLIC_PI_SANDBOX: 'true', VERCEL_ENV: 'preview' })
  assert.equal(sandboxConflict.checks.find((item) => item.id === 'mainnet-separation')?.status, 'operator_required')
  console.log('PASS Conflicting sandbox flag cannot override a Mainnet network target')

  console.log('\nRUN333 final release audit environment tests: 4/4 passed')
} finally {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]
    else process.env[key] = previous[key]
  }
}
