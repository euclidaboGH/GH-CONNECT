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
const checks = [
  ['Referral attribution resolves IDs through the canonical service', referral.includes('resolvePublicIdentity(normalized)')],
  ['Referral input normalizes and validates GreenHaven ID format', referral.includes('normalizeGreenHavenId') && referral.includes('isValidGreenHavenIdFormat')],
  ['Referral lookup does not depend on legacy profile columns', !referral.includes('gh_profiles') && !referral.includes('green_haven_id')],
  ['Public ID resolver requires authentication', resolveRoute.includes('resolveAuthenticatedUser')],
  ['Public ID API exposes only its minimal identity DTO', resolveRoute.includes('toPublicIdentityDto(row)')],
  ['Production identity resolution fails closed when database RPC fails', publicIdService.includes('return await rpcResolve(id)') && publicIdService.includes('return await rpcEnsure(')],
  ['Database enforces unique canonical IDs', migration.includes('UNIQUE INDEX IF NOT EXISTS uq_ghc_public_identities_public_id')],
  ['Database validates canonical GreenHaven ID shape', migration.includes("public_id ~ '^GH-[A-Z0-9]{6}$'")],
  ['Client writes to identity table remain denied', migration.includes('WITH CHECK (false)') && migration.includes('GRANT EXECUTE ON FUNCTION public.ghc_resolve_public_id')],
]
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
const failed = checks.filter(([, ok]) => !ok)
console.log(`\nPhase 2 canonical identity checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
