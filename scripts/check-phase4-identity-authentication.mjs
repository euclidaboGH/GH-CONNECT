#!/usr/bin/env node
/** Phase 4 Identity & Authentication source contracts. */
import { readFileSync } from 'node:fs'
import { hasProjectDoc } from './lib/read-project-doc.mjs'
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
const sessionProposal = read('supabase/proposals/20261118_phase4_identity_group_contact.sql')

test('session max concurrent cap is defined', /SESSION_MAX_ACTIVE_PER_USER\s*=\s*8/.test(session))
test('session create enforces concurrent session ceiling', /SESSION_CAP_ENFORCED/.test(session) && /gh_session_issue_with_cap/.test(session) && /pg_advisory_xact_lock/.test(sessionProposal))
test('session tokens are hashed; raw tokens are not logged', /hashToken/.test(session) && /Never log raw tokens/.test(session))
test('production refuses memory-only sessions', /SESSION_DURABILITY_UNAVAILABLE/.test(session))
test('session rotation API exists for privilege elevation', /export async function rotateSession/.test(session))
test('step-up requires gh_session and identity mapping match', /SESSION_REQUIRED/.test(stepUp) && /IDENTITY_MISMATCH/.test(stepUp))
test('step-up rejects client-forged stepUp flags without Pi token', /client_flag_only|INVALID_STEP_UP/.test(stepUp))
test('step-up rotates session before issuing proof and reports rotation', /rotateSession/.test(stepUp) && /SESSION_ROTATED_AFTER_STEP_UP/.test(stepUp) && stepUp.indexOf('rotateSession({') < stepUp.indexOf('createStepUp({') && /sessionRotated: true/.test(stepUp) && /if \(rotatedSession\) response\.headers\.append\("Set-Cookie"/.test(stepUp))
test('auth integrity module requires durable store in production', /SESSION_DURABILITY_UNAVAILABLE/.test(integrity) && /requireGhSession/.test(integrity))
test('session list requires gh_session not bare Pi bearer', /SESSION_REQUIRED/.test(sessionsList) && /resolveAuthenticatedUser/.test(sessionsList))
test('revoke-others requires step-up policy', /requireRecentStepUp|step-up/.test(revokeOthers))
test('logout clears cookie and attempts step-up revocation', /buildClearSessionCookieHeader/.test(logout) && /revokeStepUpsForSession/.test(logout))
test('dev user: tokens are rejected in production', /REJECTED_DEV_TOKEN_IN_PRODUCTION/.test(auth))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('phase 4 checker is registered in prebuild', pkg.scripts?.['prebuild:checks']?.includes('check-phase4-identity-authentication.mjs'))
test('phase 4 programme doc exists in canonical or preserved historical documentation', hasProjectDoc('docs/PHASE-4-IDENTITY-AUTHENTICATION-2026-11-08.md'))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 4 identity & authentication: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
