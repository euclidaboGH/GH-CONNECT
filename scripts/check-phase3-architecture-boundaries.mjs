#!/usr/bin/env node
/** Focused source contract for Phase 3's centralized durable account-security gate. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const route = read('app/api/auth/sessions/revoke-others/route.ts')
const integrity = read('lib/server/identity/auth-integrity.ts')
const checks = [
  ['revoke-others route delegates to the centralized account-security gate', route.includes('await requireAccountSecurityContext(request.headers)')],
  ['revoke-others route no longer duplicates its own auth-source gate', !route.includes('resolveAuthenticatedUser(') && !route.includes('auth.source !== "gh_session"')],
  ['central gate checks durable session storage before session auth', integrity.indexOf('requireDurableSessionStore()') < integrity.indexOf('return requireGhSession(headers)')],
  ['production-like environments fail closed when session storage is not durable', integrity.includes('SESSION_DURABILITY_UNAVAILABLE') && integrity.includes('isSessionStoreDurable()')],
  ['recent step-up remains required after session gate', route.includes('requireRecentStepUp(auth)')],
  ['rate limiting remains in place for revoke-others', route.includes('checkRateLimit(`sessions_revoke_others:${auth.userId}`')],
  ['other sessions’ step-up state is revoked before session revocation', route.indexOf('revokeStepUpsForSession(s.id)') < route.indexOf('revokeOtherSessionsForUser(auth.userId, auth.sessionId)')],
]
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
const failed = checks.filter(([, ok]) => !ok)
console.log(`\nPhase 3 architecture boundary checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
