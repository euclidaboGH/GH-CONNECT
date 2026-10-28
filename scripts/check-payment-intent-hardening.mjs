#!/usr/bin/env node
/** Regression guard for bounded, authenticated payment-intent API requests. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'app/api/payments/intents/route.ts'), 'utf8')
const checks = [
  ['payment-intent creation is authenticated', source.indexOf('resolveAuthenticatedUser') < source.indexOf('createPaymentIntent(')],
  ['creation requests are rate limited per user', source.includes('payment-intent:create:${auth.userId}') && source.includes('checkRateLimit(`payment-intent:create:${auth.userId}`, 12, 60_000)')],
  ['intent listing is rate limited per user', source.includes('payment-intent:list:${auth.userId}')],
  ['raw body is bounded before JSON parsing', source.indexOf('rawBody.length > MAX_INTENT_BODY_CHARS') < source.indexOf('JSON.parse(rawBody)')],
  ['non-object JSON bodies are rejected', source.includes('Array.isArray(parsed)') && source.includes('INVALID_JSON_BODY')],
  ['metadata payload has an explicit size limit', source.includes('MAX_METADATA_CHARS') && source.includes('METADATA_TOO_LARGE')],
  ['reference IDs have a maximum length', source.includes('MAX_REFERENCE_ID_CHARS') && source.includes('REFERENCE_ID_TOO_LONG')],
  ['idempotency keys reject excessive length and line breaks', source.includes('MAX_IDEMPOTENCY_KEY_CHARS') && source.includes('INVALID_IDEMPOTENCY_KEY')],
  ['GHC packs still require the catalog-owned intent route', source.includes('USE_GHC_PACK_INTENT_ROUTE')],
  ['payment intents still require durable persistence', source.includes('assertDurableWrite(intent)')],
  ['intent listing remains scoped to authenticated user', source.includes('listIntentsForUserAsync(auth.userId)')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nPayment-intent hardening checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
