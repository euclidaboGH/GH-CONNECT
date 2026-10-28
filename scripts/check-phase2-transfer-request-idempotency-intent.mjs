#!/usr/bin/env node
/** Regression checks for immutable transfer-request idempotency intent. */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = await readFile(join(root, 'supabase/migrations/20261027010004_ghc_transfer_request_idempotency_intent.sql'), 'utf8')
const fn = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.ghc_create_transfer_request'), migration.indexOf('-- Atomic accept'))
const checks = [
  ['rejects missing, oversized, or control-character references', /length\(p_reference_id\) > 128[\s\S]*?p_reference_id ~ '\[\[:cntrl:\]\]'/.test(fn)],
  ['bounds request note length and control characters', /length\(COALESCE\(p_note, ''\)\) > 500[\s\S]*?COALESCE\(p_note, ''\) ~ '\[\[:cntrl:\]\]'/.test(fn)],
  ['binds idempotency to requester identity', /v_existing\.requester_id IS DISTINCT FROM p_requester_id/.test(fn)],
  ['binds idempotency to payer identity', /v_existing\.payer_id IS DISTINCT FROM p_payer_id/.test(fn)],
  ['binds idempotency to exact amount', /v_existing\.amount IS DISTINCT FROM p_amount/.test(fn)],
  ['binds idempotency to normalized note', /v_existing\.note IS DISTINCT FROM NULLIF\(trim\(COALESCE\(p_note, ''\)\), ''\)/.test(fn)],
  ['returns stable conflict instead of reusing mismatched request', /'IDEMPOTENCY_CONFLICT'/.test(fn)],
  ['checks intent after a unique-key race', /EXCEPTION WHEN unique_violation THEN[\s\S]*?IDEMPOTENCY_CONFLICT/.test(fn)],
  ['only treats the reference unique constraint as an idempotent race', /GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;[\s\S]*?v_constraint_name IS DISTINCT FROM 'ghc_transfer_requests_reference_id_key'[\s\S]*?RAISE;/.test(fn)],
  ['fails safely if raced row cannot be reloaded', /EXCEPTION WHEN unique_violation THEN[\s\S]*?IF NOT FOUND THEN[\s\S]*?SERVER_UNAVAILABLE/.test(fn)],
  ['preserves the original request payload for true retries', /'idempotent', true,[\s\S]*?'requesterId', v_existing\.requester_id,[\s\S]*?'payerId', v_existing\.payer_id,[\s\S]*?'amount', v_existing\.amount/.test(fn)],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`RESULT ${checks.length - failures}/${checks.length}`)
if (failures) process.exitCode = 1
