#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const http = read('lib/server/economy/http.ts')
const conventions = existsSync(join(root, 'lib/server/http/api-conventions.ts'))
  ? read('lib/server/http/api-conventions.ts')
  : ''
const ownership = existsSync(join(root, 'lib/architecture/domain-ownership.ts'))
  ? read('lib/architecture/domain-ownership.ts')
  : ''
const memory = read('lib/server/economy/http.ts')
const checks = [
  ['api-conventions module exists', conventions.length > 0],
  ['createRequestId exported', /export function createRequestId/.test(conventions)],
  ['sanitizeClientMessage exported', /export function sanitizeClientMessage/.test(conventions)],
  ['financial no-store constant', /FINANCIAL_NO_STORE/.test(conventions) || /FINANCIAL_NO_STORE_HEADERS/.test(http)],
  ['jsonOk defaults to no-store', /FINANCIAL_NO_STORE_HEADERS/.test(http) && /allowStore/.test(http)],
  ['jsonErr defaults to no-store', /jsonErr/.test(http) && /FINANCIAL_NO_STORE_HEADERS/.test(http)],
  ['domain ownership map exists', ownership.length > 0],
  ['financial domains listed', /walletGhc/.test(ownership) && /walletPiEarnings/.test(ownership)],
  ['memory ledger blocked on Vercel', /VERCEL/.test(memory) && /allowMemoryServer/.test(memory)],
  ['phase1 audit doc', existsSync(join(root, 'docs/architecture/PHASE1_MASSIVE_UPGRADE_AUDIT.md'))],
  ['migration readiness doc', existsSync(join(root, 'docs/architecture/MIGRATION_READINESS_STATES.md'))],
  ['wallet read provider is non-mutating', /canMutateFinances:\s*false/.test(read('contexts/domains/wallet-read-provider.tsx'))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 1 architecture foundation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
