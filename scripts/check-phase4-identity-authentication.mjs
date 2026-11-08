#!/usr/bin/env node
/** Phase 4 Identity & Authentication source contracts. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const session = read('lib/server/identity/session-store.ts')
const integrity = read('lib/server/identity/auth-integrity.ts')
const stepUp = read('app/api/auth/step-up/route.ts')
const sessionsList = read('app/api/auth/sessions/route.ts')
const revokeOthers = read('app/api/auth/sessions/revoke-others/route.ts')
const logout = read('app/api/auth/logout/route.ts')
const auth = read('lib/server/economy/auth.ts')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')

test('session max concurrent cap is defined', /SESSION_MAX_ACTIVE_PER_USER\s*=\s*8/.test(session))
test('session create enforces concurrent session ceiling', /SESSION_CAP_ENFORCED/.test(session))
test('session tokens are hashed; raw tokens are not logged', /hashToken/.test(session) && /Never log raw tokens/.test(session))
test('production refuses memory-only sessions', /SESSION_DURABILITY_UNAVAILABLE/.test(session))
test('session rotation API exists for privilege elevation', /export async function rotateSession/.test(session))
test('step-up requires gh_session and identity mapping match', /SESSION_REQUIRED/.test(stepUp) && /IDENTITY_MISMATCH/.test(stepUp))
test('step-up rejects client-forged stepUp flags without Pi token', /client_flag_only|INVALID_STEP_UP/.test(stepUp))
test('step-up rotates session token after success', /rotateSession/.test(stepUp) && /SESSION_ROTATED_AFTER_STEP_UP/.test(stepUp))
test('auth integrity module requires durable store in production', /SESSION_DURABILITY_UNAVAILABLE/.test(integrity) && /requireGhSession/.test(integrity))
test('session list requires gh_session not bare Pi bearer', /SESSION_REQUIRED/.test(sessionsList) && /resolveAuthenticatedUser/.test(sessionsList))
test('revoke-others requires step-up policy', /requireRecentStepUp|step-up/.test(revokeOthers))
test('logout clears cookie and attempts step-up revocation', /buildClearSessionCookieHeader/.test(logout) && /revokeStepUpsForSession/.test(logout))
test('dev user: tokens are rejected in production', /REJECTED_DEV_TOKEN_IN_PRODUCTION/.test(auth))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('phase 4 checker is registered in prebuild', pkg.scripts?.prebuild?.includes('check-phase4-identity-authentication.mjs'))
test('phase 4 programme doc exists', existsSync(join(root, 'docs/PHASE-4-IDENTITY-AUTHENTICATION-2026-11-08.md')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 4 identity & authentication: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
