# GreenHaven migration audit and independent environment reconciliation

**Audit date:** 2026-11-09  
**Source release:** 0.338.13  
**Scope:** all canonical SQL migrations, generated manifests, migration operator documents, source-level migration integrity checks, and environment-history readiness.

## Executive result

**Repository migration inventory: PASS. Remote Testnet reconciliation: BLOCKED pending Supabase project access. Remote Mainnet reconciliation: BLOCKED pending separate Supabase project access.**

This is a source and documentation audit. It is not evidence that any migration is deployed, that either remote history matches the repository, or that the database schema is runtime-correct.

## Canonical source inventory

The canonical directory `supabase/migrations/*.sql` contains **199 SQL migrations**.

| Classification | Count | Meaning |
|---|---:|---|
| REQUIRED | 118 | Candidate for individual operator review; not auto-approved |
| REQUIRES_APPROVAL | 1 | Explicit product/security approval required |
| PROPOSAL | 2 | Must not be applied without written approval |
| REVIEW_REQUIRED | 78 | Held for dependency, schema, security, concurrency or provider validation |
| **Total** | **199** | Repository files only |

Additional source facts:

- All 199 filenames use the canonical 14-digit numeric version format.
- All 199 version identifiers are unique; no duplicate numeric prefixes were found.
- No empty SQL migration files were found.
- No migration filename is future-dated relative to 2026-11-09.
- The latest migration is `20261109100001_gh_messaging_phase1_controls_search.sql`.
- The generated source manifest, verified manifest, migration checklist and Testnet review-order document are synchronized.
- The current Testnet document is explicitly a review order, not permission to apply.
- There is no separate current Mainnet migration operator guide in the source archive; this document fills that documentation gap but does not claim remote Mainnet reconciliation.

## Static validation executed

The following repository checks completed successfully:

| Check | Result |
|---|---|
| `node scripts/generate-migration-inventory.mjs --check` | PASS |
| `node scripts/check-migration-source-manifest.mjs` | PASS, 199/199 |
| `node scripts/check-migration-release-readiness.mjs` | PASS, no duplicate/future versions |
| `node scripts/check-phase23-migration-integrity.mjs` | PASS, 199 migrations; 422 SECURITY DEFINER definitions inspected |
| `node scripts/check-database-rls-coverage.mjs` | PASS, 142 executable table names have explicit RLS enablement; 129 policy-bearing; 13 explicitly allowlisted |
| `node scripts/check-security-definer-acl.mjs` | PASS, 422 declarations have fixed search_path and PUBLIC execute revocation |
| `node scripts/check-clean-migrations.mjs` | PASS, 199 unique canonical SQL migrations |

These checks are source-level checks. They do not prove SQL parses and executes on the target PostgreSQL version, deployed catalog state, overload-level grants, actual RLS behavior, or application runtime compatibility.

## Migration-document consistency

The following are current generated repository authorities and passed synchronization checks:

- `MIGRATION-SOURCE-MANIFEST.csv`
- `VERIFIED_MANIFEST.txt`
- `docs/MIGRATION_CHECKLIST.md`
- `supabase/TESTNET_APPLY_ORDER.md`

The dated Phase 23/24 and pre-push audit documents are historical snapshots. Their 177-file / 0.310.0 counts are correct for their stated 2026-11-04 snapshot and must not be interpreted as the current 0.338.13 inventory. They are retained as historical evidence, not rewritten to pretend they were produced against the current release.

## Functional coverage and no-omission policy

A migration inventory is not a feature-coverage proof. Before a feature is enabled on either environment, map every durable application capability to its tables, indexes, constraints, triggers, RPCs, grants, RLS policies, storage policies and backfill/repair requirements. At minimum, coverage must include:

- Identity, authentication, sessions, step-up and WebAuthn.
- Profiles, relationships, follows, blocks, mentions and notifications.
- Posts, comments, reactions, shares, stories, polls, curation and reputation.
- Communities, membership, governance, chat, events and moderation.
- Direct/group messaging, delivery/read receipts, message edit/pin, settings, media and search.
- GHC accounts, ledger, issuance, claims, transfers, withdrawals, tips and settlement.
- Pi identity, payment intents, receipts, A2U orchestration and provider verification.
- Marketplace listings, variants, inventory, orders, fulfilment, disputes, refunds and seller payouts.
- Membership tiers, entitlements, renewals, referral and reward missions.
- Search/discovery indexes, rate limits, audit trails, retention and recovery operations.

For each feature, verify the full read/write path in source and database. A UI or API route without the corresponding durable database contract is not complete; a database object without an active source caller may be legacy, deferred or orphaned and must be classified rather than deleted speculatively.

## Testnet reconciliation — independent target record

**Status: NOT RECONCILED.**

Required evidence from the Testnet Supabase project:

1. Exact Supabase project reference and environment identity (confirm this is Testnet, not Mainnet).
2. A read-only export of `supabase_migrations.schema_migrations` (version and name, where available).
3. `supabase migration list --linked` output while explicitly linked to the Testnet project, including local/remote status.
4. Current schema/catalog evidence for migrations that appear applied remotely but differ from local source.
5. Backup/restore evidence and PostgreSQL version.

Compare remote versions against the 199 local versions and classify every difference:

- Local and remote match.
- Local pending / remote absent.
- Remote-only / local missing.
- Same version but different name.
- Same version and name but checksum/source drift (where a trusted checksum is available).
- Failed/partial migration or schema drift requiring manual inspection.

Do not rename, delete, repair migration history, or apply pending SQL until every divergence is explained. Do not use `db push` as a reconciliation tool.

## Mainnet reconciliation — independent target record

**Status: NOT RECONCILED. No Testnet result may be copied into this record.**

Repeat the full evidence collection and comparison against the independently identified Mainnet project. Mainnet must have its own project reference, migration-history export, CLI output, schema/catalog evidence, backup/restore evidence and approval record.

A migration applied on Testnet is not proof that it is applied on Mainnet. A Testnet success is not automatic Mainnet approval. Mainnet differences may be intentional and must be reviewed against the production release plan.

## Required operator sequence after project access is available

1. Capture and preserve Testnet history; reconcile it against local source.
2. Capture and preserve Mainnet history separately; reconcile it against local source.
3. Review remote-only versions and local pending migrations individually.
4. Validate candidate SQL against a disposable PostgreSQL instance matching the target version.
5. Apply individually to Testnet only after explicit approval, then run feature-specific postflight and two-account authorization tests.
6. Record exact Testnet outcome and schema evidence.
7. Review Mainnet changes independently, require production approval and a restorable backup, then apply only the approved set.
8. Re-run source inventory, remote history comparison, grants/RLS tests and runtime acceptance after each target update.

## Safety decision

- No migration was applied by this audit.
- No remote migration history was accessed.
- No remote history was repaired or marked applied.
- No migration was renamed, deleted, reordered or silently reclassified.
- No `supabase db push` is authorized by this report.
- Testnet and Mainnet remain independently unverified.

**Release boundary:** repository source/documentation integrity passes; remote database reconciliation and deployment approval remain outstanding.
