# Greenhaven migration remediation and upgrade plan — 2026-11-19

**Source release:** 0.338.108  
**Canonical migration count:** 231  
**Execution status:** repository-only checks; no database was connected or changed.

## Changes made in this maintenance pass

1. Added `scripts/check-migration-duplicate-integrity.mjs` to detect byte-identical migration SQL, duplicate 14-digit versions, duplicate basenames, empty files, and accidental promotion of review-only proposal SQL into the canonical migration directory.
2. Added `npm run check:migration-integrity`, a single repeatable command combining clean-name, duplicate-integrity, release-readiness, manifest, SECURITY DEFINER search-path, and held-migration source checks.
3. Updated the structural inventory generator to use the current package version and a configurable audit date (`MIGRATION_AUDIT_DATE=YYYY-MM-DD`) rather than writing a misleading 2026-11-09 report for a newer source tree.
4. Regenerated the structural inventory and report for 2026-11-19 and preserved the earlier dated inventory as historical evidence.
5. Added the repeated-object review CSV as a tracked audit artifact. Repeated declarations are evidence for manual semantic review, not an automatic deletion list.

## Findings retained as holds

- 231 canonical migrations have unique 14-digit version identifiers, unique SHA-256 contents, and unique basenames.
- The source manifest and Testnet apply-order document are synchronized to all 231 migration files.
- Repeated SQL declarations across files remain subject to semantic review. In particular, the mute/restrict declarations in the October 22 files are redundant historical source, but historical migrations must not be edited after deployment.
- Withdrawal PIN/recovery declarations represent schema evolution and compatibility repair; do not remove them as duplicates.
- Repeated community search index declarations use idempotent re-ensure behavior; retain until target schema reconciliation proves they can be retired safely.
- Atomic global emission V13, curation redistribution V2 idempotency, and GHPV daily-cap durability remain gated. Their SQL proposals must not be promoted to canonical migrations or enabled in the runtime until dependencies, exact live definitions, replay/concurrency behavior, ACLs, and rollback/recovery behavior are proven on disposable PostgreSQL and then Testnet.
- The RUN352 Testnet history snapshot is stale/incomplete relative to the current 231-file source. A fresh read-only `supabase migration list` and schema export are required before any migration apply or repair.

## Required next validation before a Testnet apply

1. Use Node.js 24.15.x as required by `package.json`; run `npm ci`, `npm run check:migration-integrity`, `npm run typecheck`, and `npm run build`.
2. Provision a disposable PostgreSQL/Supabase-compatible environment matching the target Postgres version and required extensions/auth/storage roles.
3. Rehearse the full clean install and the supported upgrade path; compare normalized schema dumps, RPC signatures, grants, RLS policies, indexes, constraints, triggers, and extension versions.
4. Export Testnet migration history and schema read-only. Reconcile every local version to exact remote source/content; investigate missing, extra, or divergent versions. Do not infer applied status from the old RUN352 snapshot.
5. Exercise payment, reward, referral, curation, withdrawal, A2U, marketplace, and E2E workflows with disposable Testnet identities and provider test credentials. Verify ledger idempotency, authorization, replay protection, payout state transitions, and negative cases.
6. Promote only individually approved forward-only migrations after the rehearsal. Never rewrite, delete, renumber, or reorder historical migration files. Never run bulk `supabase db push` or `supabase migration repair` from this static report.

## Explicit non-actions

No historical SQL migration was edited, deleted, renumbered, reordered, or applied. No remote database or migration history was accessed. No provider payment, reward issuance, withdrawal, or A2U transaction was initiated. This pass is not a live Testnet certification.
