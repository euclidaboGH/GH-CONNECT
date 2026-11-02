#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const wallet = readFileSync('features/wallet/wallet-balance.tsx', 'utf8')
const dashboard = readFileSync('components/ghc/unified-earnings-dashboard.tsx', 'utf8')
const checks = [
  ['wallet coalesces concurrent PI snapshot reads', /if \(piRequestRef\.current && !piRequestRef\.current\.signal\.aborted\) return/.test(wallet)],
  ['refreshing PI snapshot does not switch the balance back to a spinner', /piLoading && !piSnapshot/.test(wallet)],
  ['transient PI refresh failure preserves last verified snapshot', /Keep the last verified snapshot visible/.test(wallet) && !/setPiSnapshot\(null\)/.test(wallet)],
  ['stale PI snapshot has explicit failure status', /Last verified balance · refresh failed/.test(wallet)],
  ['manual PI refresh is disabled during initial load and active refresh', /disabled=\{piLoading \|\| piRefreshing\}/.test(wallet)],
  ['earnings dashboard coalesces event bursts and queues one post-mutation refresh', /if \(refreshInFlightRef\.current\) \{[\s\S]*?refreshQueuedRef\.current = true/.test(dashboard) && /if \(refreshQueuedRef\.current\) \{[\s\S]*?void refresh\(\)/.test(dashboard)],
  ['earnings dashboard keeps existing snapshot while refreshing', /if \(!snapRef\.current\) setLoading\(true\)/.test(dashboard)],
  ['earnings refresh failure does not clear the last verified snapshot', /setFailed\(!snapRef\.current\)/.test(dashboard) && !/setSnap\(null\)/.test(dashboard)],
  ['ledger history is retained when a transient statement read fails', /if \(sRes\.ok && sJson\?\.ok && Array\.isArray\(sJson\.entries\)\) \{\s*setEntries\(sJson\.entries\)\s*\}/.test(dashboard)],
  ['request lifecycle releases the in-flight guard in finally', /finally \{\s*refreshInFlightRef\.current = false/.test(dashboard)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nWallet refresh stability: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
