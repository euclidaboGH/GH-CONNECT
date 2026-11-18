#!/usr/bin/env node
/** Source-level guardrails for Phase 2 canonical GreenHaven identity resolution. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const referral = read('app/api/referral/attribute/route.ts')
const resolveRoute = read('app/api/economy/public-id/resolve/route.ts')
const publicIdService = read('lib/server/economy/public-id.ts')
const migration = read('supabase/migrations/20261022010004_ghc_public_identities.sql')
const hardeningMigration = read('supabase/migrations/20261028010001_ghc_canonical_identity_state_and_race_hardening.sql')
const identityDirectory = read('lib/server/economy/public-id.ts')
const identityService = read('lib/identity/identity-service.ts')
const checks = [
  ['Referral attribution resolves IDs through the canonical service', referral.includes('resolvePublicIdentity(asGh)')],
  ['Referral input normalizes and validates GreenHaven ID format', referral.includes('normalizeGreenHavenId') && referral.includes('isValidGreenHavenIdFormat')],
  ['Referral lookup does not depend on legacy profile columns', !referral.includes('gh_profiles') && !referral.includes('green_haven_id')],
  ['Public ID resolver requires authentication', resolveRoute.includes('resolveAuthenticatedUser')],
  ['Public ID API exposes only its minimal identity DTO', resolveRoute.includes('toPublicIdentityDto(row)')],
  ['Production identity resolution fails closed when database RPC fails', publicIdService.includes('return await rpcResolve(id)') && publicIdService.includes('return await rpcEnsure(')],
  ['Database enforces unique canonical IDs', migration.includes('UNIQUE INDEX IF NOT EXISTS uq_ghc_public_identities_public_id')],
  ['Database validates canonical GreenHaven ID shape', migration.includes("public_id ~ '^GH-[A-Z0-9]{6}$'")],
  ['Client writes to identity table remain denied', migration.includes('WITH CHECK (false)') && migration.includes('GRANT EXECUTE ON FUNCTION public.ghc_resolve_public_id')],
  ['verified Pi UID outranks cached explicit identity during account switches', /const candidates = \[\s*input\?\.piUid,\s*input\?\.explicitUserId,\s*input\?\.profileUserId/s.test(identityService)],
  ['canonical identity RPCs have finite network timeouts', (identityDirectory.match(/AbortSignal\.timeout\(5000\)/g) || []).length >= 2],
  ['ensure RPC response is bound to requested user and valid public ID', /returnedUserId !== userId/.test(identityDirectory) && /!GH_ID_REGEX\.test\(returnedPublicId\)/.test(identityDirectory)],
  ['resolver rejects malformed RPC identity payloads', /!returnedUserId/.test(identityDirectory) && /returnedUserId\.length > 256/.test(identityDirectory)],
  ['canonical identities model active, suspended and deleted lifecycle states', /status IN \('active', 'suspended', 'deleted'\)/.test(hardeningMigration)],
  ['suspended/deleted identities cannot be re-ensured or resolved', /existing\.status <> 'active'/.test(hardeningMigration) && /status = 'active'/.test(hardeningMigration)],
  ['same-user ensure calls serialize to prevent duplicate identity creation', /pg_advisory_xact_lock\(hashtextextended\(p_user_id, 0\)\)/.test(hardeningMigration)],
  ['identity RPCs retain service-role-only execute grants', (hardeningMigration.match(/GRANT EXECUTE ON FUNCTION public\.ghc_/g) || []).length === 2 && (hardeningMigration.match(/REVOKE ALL ON FUNCTION public\.ghc_/g) || []).length === 2],
]
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
const failed = checks.filter(([, ok]) => !ok)
console.log(`\nPhase 2 canonical identity checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
