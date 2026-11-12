# Phase 2 migration structural inventory (source-only)

**Source release:** 0.338.13  
**Audit date:** 2026-11-09  
**Status:** Static inventory generated; PostgreSQL execution and remote environment reconciliation remain blocked.

## Scope and limitations

This inventory scans every canonical 'supabase/migrations/*.sql' file. It does not connect to Supabase, execute SQL, infer actual database state, or prove dependency order. The scanner uses lexical patterns, so each signal is a review lead, not a defect verdict. In particular, 'DROP POLICY' used to replace a policy is not equivalent to dropping application data; every flagged statement must be interpreted in context.

## Inventory totals

- Canonical migration files scanned: **206**
- 'create_table': **151**
- 'alter_table': **229**
- 'create_function': **442**
- 'create_procedure': **0**
- 'create_view': **0**
- 'create_type': **0**
- 'create_index': **252**
- 'create_policy': **155**
- 'create_trigger': **23**
- 'security_definer': **457**
- 'enable_rls': **154**
- 'force_rls': **0**
- 'drop_statement': **178**
- 'truncate_statement': **0**
- 'delete_statement': **32**
- 'update_statement': **350**
- 'dynamic_execute': **5**
- 'grant_statement': **531**
- 'revoke_statement': **526**
- 'transaction_begin': **586**
- 'transaction_commit': **14**
- 'transaction_rollback': **0**

## Per-file review signals

- 'REVIEW_DATA_MUTATION': present in **122** migration file(s).
- 'REVIEW_DESTRUCTIVE_DDL': present in **86** migration file(s).
- 'REVIEW_TRIGGER_ORDER_AND_SIDE_EFFECTS': present in **15** migration file(s).
- 'REVIEW_FUNCTION_ACL_EVIDENCE': present in **14** migration file(s).
- 'REVIEW_SECURITY_DEFINER_SEARCH_PATH': present in **6** migration file(s).
- 'REVIEW_DYNAMIC_SQL': present in **4** migration file(s).
- 'REVIEW_TABLE_RLS_CONTEXT': present in **1** migration file(s).
- 'REVIEW_STORAGE_DEPENDENCY': present in **1** migration file(s).

Full per-migration counts and flags are in 'MIGRATION-STRUCTURAL-INVENTORY-2026-11-09.csv'.

## Required validation sequence

1. Preserve separate read-only migration-history exports for Testnet and Mainnet; never infer one from the other.
2. Reconcile local migration versions against each target history before any apply/repair. Supabase compares migration timestamps; repair changes history records and does not execute or undo SQL.
3. Rehearse the full candidate chain on disposable PostgreSQL matching the target version, including extensions, roles, auth/storage objects, RLS, grants, triggers and RPC signatures.
4. For every flagged file, inspect surrounding SQL and classify the signal as expected, approved, defect, or unresolved.
5. Test rollback/recovery assumptions explicitly; do not assume arbitrary DDL is transactionally reversible.
6. Only after the rehearsal and target-history reconciliation, prepare a separately approved per-migration Testnet plan. Mainnet requires independent evidence and approval.

## Current phase decision

- No SQL migration was applied or modified by this inventory generation.
- No remote migration history was accessed or repaired.
- The full dependency graph is **not yet proven** by this static inventory.
- Do not run 'supabase db push' or 'supabase migration repair' based on these findings alone.
