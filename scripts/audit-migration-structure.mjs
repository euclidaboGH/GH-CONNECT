#!/usr/bin/env node
/**
 * Phase 2 source-only migration structural inventory.
 * Never connects to a database and never executes SQL. Regex findings are review signals,
 * not a PostgreSQL parser or proof of runtime dependency correctness.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')
const outDir = join(root, 'docs')
const date = '2026-11-09'
const patterns = {
  create_table: /\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi,
  alter_table: /\bALTER\s+TABLE\b/gi,
  create_function: /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/gi,
  create_procedure: /\bCREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\b/gi,
  create_view: /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\b/gi,
  create_type: /\bCREATE\s+TYPE\b/gi,
  create_index: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi,
  create_policy: /\bCREATE\s+POLICY\b/gi,
  create_trigger: /\bCREATE\s+(?:CONSTRAINT\s+)?TRIGGER\b/gi,
  security_definer: /\bSECURITY\s+DEFINER\b/gi,
  enable_rls: /\bALTER\s+TABLE\b[\s\S]{0,180}?\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gi,
  force_rls: /\bALTER\s+TABLE\b[\s\S]{0,180}?\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/gi,
  drop_statement: /\bDROP\s+(?:TABLE|FUNCTION|PROCEDURE|POLICY|TRIGGER|TYPE|VIEW|SCHEMA|INDEX|ROLE)\b/gi,
  truncate_statement: /\bTRUNCATE\b/gi,
  delete_statement: /\bDELETE\s+FROM\b/gi,
  update_statement: /\bUPDATE\s+(?:ONLY\s+)?[\w."`]+/gi,
  dynamic_execute: /\bEXECUTE\s+(?:format\s*\(|(?:v_sql|v_query|v_stmt|sql_text|dynamic_sql)\b)/gi,
  grant_statement: /\bGRANT\b/gi,
  revoke_statement: /\bREVOKE\b/gi,
  transaction_begin: /\bBEGIN\s*(?:;|$)/gim,
  transaction_commit: /\bCOMMIT\s*;/gi,
  transaction_rollback: /\bROLLBACK\s*;/gi,
}
const quoteCsv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
const rows = []
for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  const lower = sql.toLowerCase()
  const counts = {}
  for (const [key, regex] of Object.entries(patterns)) counts[key] = [...sql.matchAll(new RegExp(regex.source, regex.flags))].length
  const flags = []
  if (counts.drop_statement || counts.truncate_statement) flags.push('REVIEW_DESTRUCTIVE_DDL')
  if (counts.dynamic_execute) flags.push('REVIEW_DYNAMIC_SQL')
  if (counts.security_definer && !/set\s+search_path\s*=/.test(lower)) flags.push('REVIEW_SECURITY_DEFINER_SEARCH_PATH')
  if (counts.security_definer && !/revoke\s+all\s+on\s+function|revoke\s+execute\s+on\s+function|revoke\s+all\s+on\s+all\s+functions/.test(lower)) flags.push('REVIEW_FUNCTION_ACL_EVIDENCE')
  if (counts.create_table && !/enable\s+row\s+level\s+security/.test(lower) && !/security\s+definer/.test(lower)) flags.push('REVIEW_TABLE_RLS_CONTEXT')
  if (counts.update_statement || counts.delete_statement || counts.truncate_statement) flags.push('REVIEW_DATA_MUTATION')
  if (counts.create_trigger) flags.push('REVIEW_TRIGGER_ORDER_AND_SIDE_EFFECTS')
  if (/\bcreate\s+extension\b/i.test(sql)) flags.push('REVIEW_EXTENSION_PREREQUISITE')
  if (/\bcreate\s+publication\b|\balter\s+publication\b/i.test(sql)) flags.push('REVIEW_REALTIME_PUBLICATION')
  if (/\bcron\.|\bpg_cron\b|\bnet\.http_/i.test(sql)) flags.push('REVIEW_SCHEDULED_OR_NETWORK_SIDE_EFFECT')
  if (/\bstorage\./i.test(sql)) flags.push('REVIEW_STORAGE_DEPENDENCY')
  rows.push({ file, ...counts, review_flags: [...new Set(flags)].join(';') || 'NONE_STATIC_SIGNAL' })
}
const keys = ['file', ...Object.keys(patterns), 'review_flags']
writeFileSync(join(outDir, 'MIGRATION-STRUCTURAL-INVENTORY-2026-11-09.csv'), [keys.join(','), ...rows.map((r) => keys.map((k) => quoteCsv(r[k])).join(','))].join('\n') + '\n')
const totals = Object.fromEntries(Object.keys(patterns).map((k) => [k, rows.reduce((n, r) => n + r[k], 0)]))
const flagTotals = new Map()
for (const r of rows) for (const f of r.review_flags.split(';')) if (f !== 'NONE_STATIC_SIGNAL') flagTotals.set(f, (flagTotals.get(f) ?? 0) + 1)
const report = `# Phase 2 migration structural inventory (source-only)\n\n**Source release:** 0.338.13  \n**Audit date:** ${date}  \n**Status:** Static inventory generated; PostgreSQL execution and remote environment reconciliation remain blocked.\n\n## Scope and limitations\n\nThis inventory scans every canonical 'supabase/migrations/*.sql' file. It does not connect to Supabase, execute SQL, infer actual database state, or prove dependency order. The scanner uses lexical patterns, so each signal is a review lead, not a defect verdict. In particular, 'DROP POLICY' used to replace a policy is not equivalent to dropping application data; every flagged statement must be interpreted in context.\n\n## Inventory totals\n\n- Canonical migration files scanned: **${rows.length}**\n${Object.entries(totals).map(([k, v]) => `- '${k}': **${v}**`).join('\n')}\n\n## Per-file review signals\n\n${[...flagTotals.entries()].sort((a,b)=>b[1]-a[1]).map(([f,n])=>`- '${f}': present in **${n}** migration file(s).`).join('\n')}\n\nFull per-migration counts and flags are in 'MIGRATION-STRUCTURAL-INVENTORY-2026-11-09.csv'.\n\n## Required validation sequence\n\n1. Preserve separate read-only migration-history exports for Testnet and Mainnet; never infer one from the other.\n2. Reconcile local migration versions against each target history before any apply/repair. Supabase compares migration timestamps; repair changes history records and does not execute or undo SQL.\n3. Rehearse the full candidate chain on disposable PostgreSQL matching the target version, including extensions, roles, auth/storage objects, RLS, grants, triggers and RPC signatures.\n4. For every flagged file, inspect surrounding SQL and classify the signal as expected, approved, defect, or unresolved.\n5. Test rollback/recovery assumptions explicitly; do not assume arbitrary DDL is transactionally reversible.\n6. Only after the rehearsal and target-history reconciliation, prepare a separately approved per-migration Testnet plan. Mainnet requires independent evidence and approval.\n\n## Current phase decision\n\n- No SQL migration was applied or modified by this inventory generation.\n- No remote migration history was accessed or repaired.\n- The full dependency graph is **not yet proven** by this static inventory.\n- Do not run 'supabase db push' or 'supabase migration repair' based on these findings alone.\n`
writeFileSync(join(outDir, 'PHASE-2-MIGRATION-STRUCTURAL-AUDIT-2026-11-09.md'), report)
console.log(`Phase 2 structural inventory generated. Files=${rows.length}; signals=${[...flagTotals.values()].reduce((a,b)=>a+b,0)}.`)
console.log(`Counts: ${Object.entries(totals).map(([k,v])=>`${k}=${v}`).join(', ')}`)
console.log('No database connection or SQL execution performed.')
