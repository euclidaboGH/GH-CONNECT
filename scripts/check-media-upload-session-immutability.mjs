#!/usr/bin/env node
/** Source-level regression guards for immutable media upload-session identity. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(join(root, 'supabase/migrations/20261027010001_gh_media_upload_session_immutable_identity.sql'), 'utf8')
const checks = [
  ['migration inserts new upload sessions without updating conflicts', /ON CONFLICT\s*\(upload_id\)\s*DO NOTHING/i.test(migration) && !/ON CONFLICT\s*\(upload_id\)\s*DO UPDATE/i.test(migration)],
  ['existing upload identity compares owner, bucket, and path', ['r.owner_id IS DISTINCT FROM v_owner_id','r.bucket IS DISTINCT FROM v_bucket','r.storage_path IS DISTINCT FROM v_storage_path'].every((part) => migration.includes(part))],
  ['existing upload identity compares media contract and expected size', ['r.category IS DISTINCT FROM v_category','r.mime_type IS DISTINCT FROM v_mime_type','r.media_kind IS DISTINCT FROM v_media_kind','r.expected_bytes IS DISTINCT FROM p_expected_bytes'].every((part) => migration.includes(part))],
  ['metadata contract is immutable across retries', migration.includes('r.metadata IS DISTINCT FROM v_metadata')],
  ['conflicting upload ID is rejected without reassigning ownership', migration.includes("'error', 'UPLOAD_ID_CONFLICT'") && !/UPDATE\s+public\.gh_media_upload_sessions\s+SET\s+owner_id/i.test(migration)],
  ['upload ID and owner-scoped storage path are validated', migration.includes("v_upload_id !~ '^upload_[a-f0-9]{24,40}$'") && migration.includes('v_storage_path NOT LIKE v_owner_id || \'/%\'')],
  ['function execution remains restricted to service_role', migration.includes('REVOKE ALL ON FUNCTION public.gh_media_upload_session_create') && migration.includes('TO service_role')],
  ['function uses a hardened search path', migration.includes('SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nMedia upload-session immutability checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
