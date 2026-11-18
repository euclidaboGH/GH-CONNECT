# Run #302 — Live Supabase migration reconciliation and Mainnet readiness

**Source archive:** `GREENHAVEN-0.338.86-RUN302-PI-A2U-SAFETY-CORRECTIONS.zip`  
**Audit date:** 2026-11-16  
**Scope:** Read-only inspection of GH Connect Testnet and GH Connect Mainnet, plus static source checks.  
**Database DDL applied by this audit:** None.  
**Migration history edited by this audit:** None.

## Executive disposition

**MAINNET MIGRATION RELEASE: HOLD — no approved clean-install migration set exists yet.**

The repository is structurally organized, but it is not yet a reconciled, clean-install-ready migration release. The existing canonical installer is generated from every file in `supabase/migrations`, including held migrations and proposal SQL. The migration source manifest currently classifies 119 files as `REQUIRED` (candidate for review, not approved), 102 as `REVIEW_REQUIRED`, one as `REQUIRES_APPROVAL`, and two as `PROPOSAL`. No file is automatically approved for Mainnet by these labels.

## Live project evidence

| Evidence | GH Connect Testnet | GH Connect Mainnet |
|---|---|---|
| Project ref | `tpckwgdsjlkzscjlxiwe` | `rrrtjowuldcpbjobbpic` |
| Region | `eu-west-1` | `eu-west-1` |
| PostgreSQL | 17.11.0.003 | 17.6.1.166 |
| Supabase migration history rows | 43 | 0 |
| Public application tables | Existing populated application schema | 0 |
| Latest known applied migration | `20261116054242` | None recorded |

The Testnet migration history was read from Supabase and compared exactly by `(version, name)` against the 224 canonical local SQL filenames. Results are in `RUN302-TESTNET-MIGRATION-HISTORY-RECONCILIATION.csv`.

- 12 of 43 Testnet history records have an exact local filename/version source.
- 31 of 43 do not have an exact local filename/version source. Some may have equivalent-purpose source files under another timestamp; equivalence is not an exact history match and must not be assumed.
- The two latest remote records, `20261116054218_gh_feed_preferences_durable` and `20261116054242_gh_feed_preferences_safe_array_constraints`, are absent as exact local files. The archive has `20261114100001_gh_feed_preferences_durable.sql`, which is not the same migration version and combines the final safe-array checks into its initial definition. Preserve the remote history; do not rename or replay the local file to disguise the mismatch.
- Run #302 `20261116045934_pi_wallet_scope_consent_provider_address_discovery.sql` is present under its exact version/name and is recorded as applied to Testnet. It is not approved for Mainnet merely because it is applied to Testnet.

Mainnet's migration history is empty and its `public` schema currently contains no application tables. This is not evidence that the entire database is blank: an enabled `ddl_command_end` event trigger named `ensure_rls` is present and uses `public.rls_auto_enable()`. The function is owned by `postgres`, is `SECURITY DEFINER`, has `search_path=pg_catalog`, and the Supabase security advisor reports it executable by `anon` and `authenticated`. Because it is an event-trigger function, do not treat that finding as proof it is callable as a normal PostgREST RPC. It needs an explicit platform/trigger review; this audit did not alter or drop it.

Testnet's security advisor reports 13 `rls_enabled_no_policy` informational findings. The live tables are in the project's deny-client pattern in which RLS is enabled and no policy grants client access; these are not automatically defects. Verify table grants and service-role-only RPC paths during the final security pass rather than adding permissive policies to silence the advisor.

## Repository inventory and checks

- Canonical SQL files: 224.
- Classification: 119 `REQUIRED`, 102 `REVIEW_REQUIRED`, 1 `REQUIRES_APPROVAL`, 2 `PROPOSAL`.
- All 224 filenames use unique 14-digit versions; no duplicate version prefixes or empty migration files were found by the clean-migration structure check.
- `scripts/check-clean-migrations.mjs`: PASS (224 unique 14-digit SQL files).
- `scripts/check-migration-source-manifest.mjs`: initially failed because the Run #302 applied-Testnet action for migration `20261116045934` was missing from the script's explicit allowlist. The allowlist was corrected; rerun PASS (224/224, manifest/checklist/apply guide synchronized).
- `scripts/check-migration-release-readiness.mjs`: PASS for static chronology/policy checks only.
- `scripts/audit-migration-structure.mjs`: completed structural inventory (224 files; no database execution).
- No PostgreSQL clean replay, SQL parser validation, disposable database test, transactional/concurrency test, or full clean-install rehearsal was performed in this environment. Do not interpret static checks as SQL execution proof.

## Unsafe Mainnet shortcuts — prohibited

1. Do not run `supabase db push` against Mainnet with the current 224-file canonical directory.
2. Do not execute `supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` as-is. It is generated from every canonical migration, and inspection confirms it includes proposal SQL and held/review-required migrations.
3. Do not run `RESET-GREENHAVEN-DATABASE.sql` on either live project.
4. Do not delete, squash, rename, or repair remote migration history to make counts match.
5. Do not mark migrations as applied without proving the exact SQL and resulting schema state.
6. Do not copy Testnet's migration history onto Mainnet. Mainnet needs an independently validated bootstrap sequence.
7. Do not apply the 102 review-required files, the approval-gated file, or the two proposals as a batch.

## Required work before a clean Mainnet migration release

1. Recover the exact SQL statement arrays for all 31 Testnet history rows without exact local source filenames. Store recovered historical statements in a clearly separate Testnet history archive; do not make duplicate-purpose files eligible for a fresh Mainnet push.
2. Compare recovered SQL to the local source files by normalized content and SHA-256. Classify each record as exact, equivalent-but-versioned, remote-only, or source-drifted; preserve duplicate applied records (including the duplicate cleanup records) as history evidence.
3. Build a fresh-install dependency graph from the actual DDL/function dependencies. Resolve every held migration, superseded migration, proposal, and approval gate. Do not assume lexical filename order proves dependency order.
4. Produce a separate Mainnet bootstrap set containing only migrations that have passed source review, dependency review, SQL execution on a disposable PostgreSQL 17 database, RLS/grant/advisor checks, and feature-specific regression/concurrency tests.
5. Generate the Mainnet installer only from that approved set; assert that it contains no `PROPOSAL`, `REVIEW_REQUIRED`, or `REQUIRES_APPROVAL` SQL.
6. Rehearse a complete empty-database install, then run `VALIDATE-CLEAN-INSTALL.sql`, `VALIDATE-GREENHAVEN-DATABASE.sql`, security/performance advisors, and financial invariants. Confirm backup/restore and production change ownership before any Mainnet DDL.
7. Apply individually approved migrations under a separate production change plan, with pre/postflight evidence and explicit operator authorization.

## Current release decision

**HOLD.** Testnet is operational but its exact source-history reconciliation is incomplete. Mainnet has zero application tables and zero recorded migrations, but no validated clean bootstrap package. No production migration is authorized by this report.
