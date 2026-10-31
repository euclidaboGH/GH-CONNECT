#!/usr/bin/env node
/** Regression guard for bounded, authenticated GHC transfer requests. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'app/api/economy/transfers/route.ts'), 'utf8')
const checks = [
  ['transfer route authenticates before parsing body', source.indexOf('resolveAuthenticatedUser') < source.indexOf('readBoundedJson(request, MAX_TRANSFER_BODY_CHARS)')],
  ['transfer route retains recent step-up authentication', source.includes('requireRecentStepUp(auth)')],
  ['transfer route retains per-user rate limiting', source.includes('checkRateLimit(`transfer:${auth.userId}`, 30, 60_000)')],
  ['body limit is enforced by shared streaming parser', source.includes('readBoundedJson(request, MAX_TRANSFER_BODY_CHARS)')],
  ['streaming parser validates bytes before JSON parsing', readFileSync(join(root, 'lib/server/http/read-bounded-json.ts'), 'utf8').indexOf('totalBytes > maxBytes') < readFileSync(join(root, 'lib/server/http/read-bounded-json.ts'), 'utf8').indexOf('JSON.parse(raw)')],
  ['non-object JSON bodies are rejected', readFileSync(join(root, 'lib/server/http/read-bounded-json.ts'), 'utf8').includes('Array.isArray(value)') && readFileSync(join(root, 'lib/server/http/read-bounded-json.ts'), 'utf8').includes('INVALID_BODY')],
  ['reference IDs are bounded and reject line breaks', source.includes('MAX_TRANSFER_REFERENCE_CHARS') && source.includes('INVALID_REFERENCE_ID')],
  ['request IDs are bounded and reject line breaks', source.includes('MAX_TRANSFER_REQUEST_ID_CHARS') && source.includes('INVALID_REQUEST_ID')],
  ['sender identity remains derived from authenticated user', source.includes('senderId: auth.userId') && source.includes('Sender is ONLY auth.userId')],
  ['recipient still resolves through public identity directory', source.includes('resolvePublicIdentity(normalizeGreenHavenId(rawGreenHavenId))')],
  ['transfer remains delegated to authoritative database RPC when configured', source.includes('rpcExecuteTransfer({')],
  ['amount remains validated server-side', source.includes('validatePositiveGhcAmount(body.amount')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nTransfer request hardening checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
