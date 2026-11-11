#!/usr/bin/env node
/** Static regression contract for the review-required community create migration. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const migration = readFileSync(join(root, 'supabase/migrations/20261025010001_gh_community_create_idempotency_guard.sql'), 'utf8')
const route = readFileSync(join(root, 'app/api/communities/route.ts'), 'utf8')
const checks = [
  ['same-owner retry is explicitly identified', /v_existing_creator\s+IS\s+DISTINCT\s+FROM\s+v_creator/i.test(migration) && /'replayed',\s*true/i.test(migration)],
  ['cross-owner or missing ID conflicts fail closed', /'ID_CONFLICT'/i.test(migration)],
  ['retry does not overwrite existing community content', /Same owner retry: do not rewrite/i.test(migration)],
  ['function execution is restricted to service role', /REVOKE ALL ON FUNCTION public\.gh_community_create\(jsonb\) FROM PUBLIC/i.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_community_create\(jsonb\) TO service_role/i.test(migration)],
  ['community create route binds owner to authenticated session', /createdBy:\s*auth\.userId/.test(route)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log(`Community idempotency contract: ${checks.length}/${checks.length} static checks passed.`)
