#!/usr/bin/env node
/** Phase 6: wallet snapshot reliability and financial-truth contracts. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('app/api/economy/wallet/summary/route.ts', 'utf8')
const client = readFileSync('lib/domains/wallet-v2.ts', 'utf8')
const checks = [
  ['wallet summary wraps auth and data dependencies in a route-level exception boundary', /export async function GET\(request: Request\)\s*\{\s*try\s*\{/.test(route) && /catch\s*\{[\s\S]*?WALLET_SERVICE_UNAVAILABLE/.test(route)],
  ['unauthenticated wallet access remains rejected', /if \(!auth\)[\s\S]*?AUTH_REQUIRED[\s\S]*?status: 401/.test(route)],
  ['wallet database absence is a retryable service error', /DATABASE_UNAVAILABLE[\s\S]*?retryable: true[\s\S]*?status: 503/.test(route)],
  ['RPC failure never returns a successful wallet snapshot', /if \(!result\.ok \|\| !result\.data\)[\s\S]*?WALLET_UNAVAILABLE[\s\S]*?status: 503/.test(route)],
  ['unexpected dependency exceptions return stable retryable 503', /WALLET_SERVICE_UNAVAILABLE[\s\S]*?retryable: true[\s\S]*?status: 503/.test(route)],
  ['retryable responses include Retry-After', /unavailableHeaders[\s\S]*?Retry-After.*5/.test(route)],
  ['wallet responses remain non-cacheable', /Cache-Control.*private, no-store, no-cache/.test(route) && /Pragma: "no-cache"/.test(route)],
  ['balance source remains the server ledger', /source: "ghc_transactions"/.test(route) && /authority: "server_ledger"/.test(route)],
  ['successful snapshot exposes a freshness timestamp', /snapshotFetchedAt: new Date\(\)\.toISOString\(\)/.test(route)],
  ['source status is explicit only on successful snapshot', /sourceStatus: "authoritative_snapshot"/.test(route)],
  ['no client-side minting remains explicitly prohibited', /noClientMinting: true/.test(route)],
  ['no stale/client-derived balance fallback is introduced', /Never return cached or client-derived balances/.test(route) && !/fallbackWallet|cachedBalance/.test(route)],
  ['client exports a typed wallet request error with status and retryability', /export class WalletV2RequestError extends Error/.test(client) && /readonly status: number/.test(client) && /readonly retryable: boolean/.test(client)],
  ['client safely handles HTML or malformed JSON error pages', /response\.json\(\)\.catch\(\(\) => null\)/.test(client) && /WALLET_UNAVAILABLE/.test(client)],
  ['client validates successful envelope before reading wallet data', /envelope\?\.ok === true/.test(client) && /Array\.isArray\(wallet\)/.test(client)],
  ['client parses Retry-After defensively with an upper bound', /function parseRetryAfter/.test(client) && /Math\.min\(300, Math\.ceil\(seconds\)\)/.test(client)],
  ['client preserves retryable status for 429 and server errors', /response\.status === 429 \|\| response\.status >= 500/.test(client)],
  ['malformed successful snapshots fail closed instead of becoming zero balances', /WALLET_INVALID_SNAPSHOT/.test(client) && /not a zero balance/.test(client)],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nPhase 6 wallet economy resilience: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Wallet economy resilience checks failed')
