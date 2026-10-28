#!/usr/bin/env node
/** Source-level regression guards for media asset idempotency and immutable identity. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(join(root, 'supabase/migrations/20261027010002_gh_media_asset_create_immutable_identity.sql'), 'utf8')
const checks = [
  ['asset create migration replaces the existing function signature', migration.includes('CREATE OR REPLACE FUNCTION public.gh_media_asset_create(') && migration.includes('p_metadata jsonb DEFAULT')],
  ['asset create uses a hardened SECURITY DEFINER search path', migration.includes('SECURITY DEFINER') && migration.includes('SET search_path = pg_catalog, public, pg_temp')],
  ['conflicting IDs are not overwritten', /ON CONFLICT\s*\(id\)\s*DO NOTHING/i.test(migration) && !/ON CONFLICT\s*\(id\)\s*DO UPDATE/i.test(migration)],
  ['retry checks owner, bucket, and storage path', ['r.owner_id IS DISTINCT FROM v_owner','r.bucket IS DISTINCT FROM v_bucket','r.storage_path IS DISTINCT FROM v_path'].every(x => migration.includes(x))],
  ['retry checks media type, MIME, and byte size', ['r.media_kind IS DISTINCT FROM v_kind','r.mime_type IS DISTINCT FROM v_mime','r.byte_size IS DISTINCT FROM v_size'].every(x => migration.includes(x))],
  ['retry checks dimensions, duration, URLs, and metadata', ['r.width IS DISTINCT FROM p_width','r.height IS DISTINCT FROM p_height','r.duration_ms IS DISTINCT FROM p_duration_ms','r.public_url IS DISTINCT FROM','r.thumb_path IS DISTINCT FROM','r.thumb_url IS DISTINCT FROM','r.metadata IS DISTINCT FROM v_metadata'].every(x => migration.includes(x))],
  ['deleted or non-ready records cannot be accepted as idempotent retries', migration.includes("r.status IS DISTINCT FROM 'ready'") && migration.includes('r.deleted_at IS NOT NULL')],
  ['mismatched identity returns explicit conflict', migration.includes("'error', 'MEDIA_ID_CONFLICT'")],
  ['duplicate bucket/path unique violations fail closed', migration.includes('WHEN unique_violation THEN') && migration.includes('Covers a different asset ID already claiming the same bucket/path')],
  ['idempotent flag reflects actual insert row count', migration.includes('GET DIAGNOSTICS v_inserted = ROW_COUNT') && migration.includes("'idempotent', v_inserted = 0")],
  ['function execution is restricted to service_role', migration.includes('FROM PUBLIC, anon, authenticated') && migration.includes('TO service_role')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nMedia asset immutability checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
