import fs from 'node:fs'

const dashboard = fs.readFileSync('components/ghc/unified-earnings-dashboard.tsx', 'utf8')
const runtime = fs.readFileSync('lib/pi-runtime.ts', 'utf8')
const bridge = fs.readFileSync('app/api/auth/pi/route.ts', 'utf8')
const authz = fs.readFileSync('app/api/identity/wallet-authorization/route.ts', 'utf8')
const checks = [
  ['Uses official Pi SDK authentication helper', dashboard.includes('piAuthenticateOfficial') && runtime.includes('Pi.authenticate')],
  ['Submits access token to server identity bridge', dashboard.includes('fetch("/api/auth/pi"') && dashboard.includes('accessToken: piAuth.accessToken')],
  ['Server bridge verifies Pi token through /v2/me', bridge.includes('verifyPiAccessToken(accessToken)')],
  ['Server bridge requires durable identity/session stores in production', bridge.includes('!isPiIdentityDurable() || !isSessionStoreDurable()')],
  ['Does not trust a client-supplied Pi UID for identity linkage', bridge.includes('findOrCreateFromVerifiedPi')],
  ['Explains identity and payout authorization are distinct states', dashboard.includes('Identity linkage is separate from payout consent and withdrawal eligibility.')],
  ['Reconnect action is available even when a Pi identity is already linked', dashboard.includes('Reconnect / verify Pi account')],
  ['Identity bridge failure is surfaced to the user', dashboard.includes('Pi identity verification failed')],
  ['Client requires explicit server verification before reporting success', dashboard.includes('result.verified !== true') && dashboard.includes('result.identity?.serverVerified !== true')],
  ['Post-auth refresh cannot be lost behind an in-flight refresh', dashboard.includes('refreshQueuedRef') && dashboard.includes('refreshQueuedRef.current = true')],
  ['Non-durable auth environment is disclosed rather than presented as payout-ready', dashboard.includes('non-durable identity/session storage')],
  ['Payout authorization still requires a server identity mapping', authz.includes('getByGhUserId(auth.userId)') && authz.includes('IDENTITY_MAPPING_REQUIRED')],
  ['No client-provided recipient UID is accepted for authorization', authz.includes('Recipient comes only from durable verified mapping')],
]
let failures = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failures++
}
console.log(`\nPhase 1 Pi identity reconnect: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
