#!/usr/bin/env node
/** Source-level regression guards for upload-session/media-asset finalization binding. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(join(root, 'supabase/migrations/20261027010003_gh_media_upload_finalize_identity.sql'), 'utf8')
const checks = [
  ['replaces the existing finalization RPC signature', migration.includes('CREATE OR REPLACE FUNCTION public.gh_media_upload_session_finalize(') && migration.includes('p_upload_id text, p_owner_id text, p_media_id text')],
  ['uses a hardened SECURITY DEFINER search path', migration.includes('SECURITY DEFINER') && migration.includes('SET search_path = pg_catalog, public, pg_temp')],
  ['locks the owned session before lifecycle decisions', migration.includes('WHERE upload_id = v_upload_id AND owner_id = v_owner_id') && migration.includes('FOR UPDATE')],
  ['rejects finalized-session retries with a different media ID', migration.includes("IF r.media_id <> v_media_id") && migration.includes('UPLOAD_FINALIZE_CONFLICT')],
  ['only issued or uploaded sessions can be finalized', migration.includes("r.status NOT IN ('issued', 'uploaded')")],
  ['expired sessions cannot be finalized', migration.includes('r.expires_at < now()') && migration.includes("SET status = 'expired'")],
  ['media asset must exist before session finalization', migration.includes('SELECT * INTO a FROM public.gh_media_assets WHERE id = v_media_id') && migration.includes('IF NOT FOUND')],
  ['asset identity matches owner, bucket, path, kind, MIME, and expected size', ['a.owner_id IS DISTINCT FROM r.owner_id','a.bucket IS DISTINCT FROM r.bucket','a.storage_path IS DISTINCT FROM r.storage_path','a.media_kind IS DISTINCT FROM r.media_kind','a.mime_type IS DISTINCT FROM r.mime_type','a.byte_size IS DISTINCT FROM r.expected_bytes'].every(x => migration.includes(x))],
  ['deleted or non-ready assets are rejected', migration.includes("a.status IS DISTINCT FROM 'ready'") && migration.includes('a.deleted_at IS NOT NULL')],
  ['attempt count remains within its database constraint', migration.includes('LEAST(attempts + 1, 20)')],
  ['execution is restricted to service_role', migration.includes('FROM PUBLIC, anon, authenticated') && migration.includes('TO service_role')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nMedia upload finalization identity checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
