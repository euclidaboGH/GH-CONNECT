#!/usr/bin/env node
/**
 * Phase 3 stabilization regression contract: session and step-up durability,
 * migration classification hygiene, and source-only release claims.
 * Static checks only; no database or provider is contacted.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
let passed = 0
let failed = 0
function check(condition, label) {
  if (condition) { passed++; console.log(`PASS ${label}`) }
  else { failed++; console.error(`FAIL ${label}`) }
}
const stepUp = read('lib/server/identity/step-up-store.ts')
const sessions = read('lib/server/identity/session-store.ts')
const sessionRoute = read('app/api/auth/session/route.ts')
const logoutRoute = read('app/api/auth/logout/route.ts')
const stepUpRoute = read('app/api/auth/step-up/route.ts')
const revokeSessionRoute = read('app/api/auth/sessions/[sessionId]/revoke/route.ts')
const revokeOthersRoute = read('app/api/auth/sessions/revoke-others/route.ts')
const generator = read('scripts/generate-migration-inventory.mjs')
const migrationReadiness = read('scripts/check-migration-release-readiness.mjs')
const checklist = read('docs/MIGRATION_CHECKLIST.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'))

check(stepUp.includes('STEP_UP_DURABILITY_UNAVAILABLE'), 'production step-up refuses missing/failed durable persistence')
check(stepUp.includes('Durable storage is authoritative across instances') && stepUp.indexOf('const fromDb = await dbFindValid') < stepUp.indexOf('const mem = memBySession.get(key)'), 'step-up validation checks durable state before trusting cache')
check(stepUp.includes('return false') && stepUp.includes('const persisted = await dbRevokeForSession(sid)'), 'step-up revocation reports durable persistence failures')
check(sessions.includes('const persisted = await dbPatch(existing.id') && sessions.indexOf('const persisted = await dbPatch(existing.id') < sessions.indexOf('memByHash.set(hash, revoked)'), 'same-device session revocation persists before local cache mutation')
check(sessions.includes('throw new Error("SESSION_REVOCATION_UNAVAILABLE")') && sessions.indexOf('const response = await fetch(url') < sessions.indexOf('for (const rec of active)'), 'revoke-all updates durable store before local cache')
check(stepUp.includes('const persisted = await dbInsert(rec)') && stepUp.indexOf('const persisted = await dbInsert(rec)') < stepUp.indexOf('memBySession.set(sessionKey(ghUserId, sessionId), rec)'), 'step-up enters memory only after durable write decision')
check(sessions.includes('SESSION_REVOCATION_UNAVAILABLE'), 'owned-session revoke fails visibly when durable update fails')
const tokenStart = sessions.indexOf('export async function revokeSessionByToken')
const tokenEnd = sessions.indexOf('export async function revokeAllSessionsForUser')
const tokenRevoke = sessions.slice(tokenStart, tokenEnd)
check(tokenRevoke.indexOf('await dbPatch') < tokenRevoke.indexOf('memByHash.set(tokenHash, updated)'), 'token revocation persists before mutating local cache')
const idStart = sessions.indexOf('export async function revokeSessionByIdForUser')
const idEnd = sessions.indexOf('export async function revokeOtherSessionsForUser')
const idRevoke = sessions.slice(idStart, idEnd)
check(idRevoke.indexOf('await dbPatch') < idRevoke.indexOf('memById.set(sid, updated)'), 'session-id revocation persists before mutating local cache')
check(!sessionRoute.includes('rawToken') && !sessionRoute.includes('tokenHash'), 'session status response does not expose session token material')
check(logoutRoute.includes('SESSION_REVOCATION_UNAVAILABLE') && logoutRoute.includes('status: 503'), 'logout does not falsely claim success when durable revocation fails')
check(stepUpRoute.includes('STEP_UP_DURABILITY_UNAVAILABLE') && stepUpRoute.includes('status: durabilityFailure ? 503 : 500'), 'step-up durability outage is surfaced as service unavailable')
check(logoutRoute.includes('STEP_UP_REVOCATION_UNAVAILABLE') && logoutRoute.includes('stepUpsRevoked'), 'logout does not report success if step-up revocation cannot be persisted')
check(revokeSessionRoute.includes('STEP_UP_REVOCATION_UNAVAILABLE') && revokeSessionRoute.includes('status: 503'), 'single-session route surfaces step-up durability failure')
check(revokeSessionRoute.includes('if (isCurrent) failure.headers.append("Set-Cookie", buildClearSessionCookieHeader())'), 'current-session cookie is cleared when post-revoke step-up cleanup fails')
check(revokeOthersRoute.includes('STEP_UP_REVOCATION_UNAVAILABLE') && revokeOthersRoute.includes('status: 503'), 'revoke-others route stops when step-up revocation cannot be persisted')
check(migrations.length === 109, `canonical SQL inventory is 109 files (found ${migrations.length})`)
for (const name of ['20261022_gh_content_rewards.sql','20261023_gh_profile_content_library.sql','202610250002_gh_post_restore_owner_window.sql','202610250003_gh_lifecycle_payout_quality_foundation.sql']) {
  check(generator.includes(`'${name}'`) && checklist.includes(`\`${name}\` | REVIEW_REQUIRED`), `${name} is held for review, not auto-approved`)
}
check(checklist.includes('Supabase CLI does not enforce these documentation classifications'), 'migration checklist warns classification labels do not constrain Supabase CLI')
check(manifest.includes('APPLICATION_GUARD: Supabase CLI does not enforce this classification metadata'), 'generated manifest warns about CLI application behavior')
check(checklist.includes('REQUIRED **77**') && checklist.includes('REVIEW_REQUIRED **29**'), 'generated migration counts reflect conservative review reclassification')
check(migrationReadiness.includes('Duplicate Supabase migration version') && migrations.every((name) => /^\d+_/.test(name)), 'migration release gate rejects duplicate or unversioned migration files')
console.log(`\nPhase 3 security/migration contract: ${passed} passed, ${failed} failed.`)
if (failed) process.exit(1)
