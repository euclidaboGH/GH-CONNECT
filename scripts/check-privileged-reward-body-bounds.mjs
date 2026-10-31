#!/usr/bin/env node
/** Regression guards for bounded reward claim and privileged settlement payloads. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const settle = readFileSync(join(root, 'app/api/admin/creator-rewards/settle/route.ts'), 'utf8')
const claim = readFileSync(join(root, 'app/api/economy/rewards/claim/route.ts'), 'utf8')
const checks = [
  ['privileged settlement authorizes before bounded body read', settle.indexOf('authorized(request)') < settle.indexOf('readBoundedJson(request')],
  ['settlement rejects declared and streamed oversized payloads through shared reader', settle.includes('readBoundedJson(request, MAX_SETTLEMENT_BODY_BYTES)')],
  ['settlement bounds streamed bytes before JSON parsing', settle.indexOf('readBoundedJson(request') < settle.indexOf('const rewardEventId =')],
  ['settlement rejects invalid JSON and non-object bodies via shared parser', settle.includes('parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400') && settle.includes('if (!parsed.ok)')],
  ['settlement event identifier remains bounded', settle.includes('rewardEventId.length > 160')],
  ['settlement RPC has a finite timeout', settle.includes('AbortSignal.timeout(15_000)')],
  ['reward claim authenticates before reading body', claim.indexOf('resolveAuthenticatedUser') < claim.indexOf('request.text()')],
  ['reward claim rejects declared oversized payloads', claim.includes('declaredLength > MAX_REWARD_CLAIM_BODY_BYTES')],
  ['reward claim bounds actual UTF-8 body bytes before JSON parsing', claim.indexOf('Buffer.byteLength(rawBody') < claim.indexOf('JSON.parse(rawBody)')],
  ['reward claim rejects non-object JSON bodies', claim.includes('Reward claim request must be a JSON object') && claim.includes('Array.isArray(parsed)')],
  ['reward claim ID is bounded and rejects line breaks', claim.includes('holdId.length > 160') && claim.includes('/[\\r\\n]/.test(holdId)')],
  ['reward claim amount and user remain server-derived', claim.includes('Claim amount and user are server-derived from hold ownership')],
  ['reward claim still delegates to authoritative DB RPC', claim.includes('rpcClaimPending(auth.userId, holdId)')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nPrivileged/reward request bounds: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
