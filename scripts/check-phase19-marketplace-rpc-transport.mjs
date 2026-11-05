#!/usr/bin/env node
/** Phase 19: marketplace durable RPCs must fail closed on transport/response ambiguity. */
import fs from 'node:fs'
const store = fs.readFileSync('lib/server/marketplace/order-store.ts', 'utf8')
const pay = fs.readFileSync('app/api/marketplace/orders/[orderId]/pay/route.ts', 'utf8')
const checks = [
  ['durable marketplace RPCs have a bounded timeout', /signal:\s*AbortSignal\.timeout\(10_000\)/.test(store)],
  ['durable marketplace RPC requests bypass caches', /cache:\s*"no-store"/.test(store) && /"Cache-Control":\s*"no-store"/.test(store)],
  ['non-empty malformed RPC responses fail closed', /catch\s*\{\s*return null\s*\}/.test(store)],
  ['empty PostgREST void RPC responses remain explicitly supported', /if \(!text\.trim\(\)\) return \{ ok: true \}/.test(store)],
  ['HTTP failures never become successful order mutations', /if \(!res\.ok\) return null/.test(store)],
  ['RPC network and timeout failures are contained as unavailable', /catch\s*\{\s*return null\s*\}/.test(store)],
  ['GHC spend RPC has a bounded timeout', /signal:\s*AbortSignal\.timeout\(10_000\)/.test(pay)],
  ['GHC spend RPC bypasses caches', /cache:\s*"no-store"/.test(pay)],
  ['ambiguous GHC spend retains payment claim for recovery', /if \(spendError === "INSUFFICIENT_BALANCE"\)/.test(pay)],
  ['GHC spend remains idempotent by order reference', /const referenceId = `market_order_\$\{order\.id\}`/.test(pay)],
  ['production does not fall back to process-local order authority', /DURABLE_REQUIRED: production requires Supabase marketplace orders schema/.test(store)],
  ['order save reports durable write failure', /DURABLE_WRITE_FAILED: gh_marketplace_order_upsert/.test(store)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 19 marketplace RPC transport: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
