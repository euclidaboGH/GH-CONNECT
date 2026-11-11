# GreenHaven 0.338.20 / Run249 — source integrity review

**Review date:** 2026-11-10  
**Authoritative input:** `GREENHAVEN-0.338.20-RUN249-15-SAFE-UPGRADES.zip`  
**Review scope:** archive integrity, migration inventory/manifest, SQL lexical integrity, source-level release/security contracts, and available local verification.  
**Decision:** Source-level verification completed for the checks listed below. **NOT DATABASE-VERIFIED / NOT RELEASE-APPROVED.**

## Executive result

The supplied ZIP is readable and passes the ZIP integrity test. The canonical source contains 201 SQL migrations. The complete repository `npm run verify:static` command passed in the available environment. Targeted migration, wallet-recovery, security and marketplace/community checks also passed.

This does not establish that the 201 migrations have been executed, that migrations 1–189 all completed on the user's Supabase Testnet project, or that the live schema matches this source. The user reports that some manually executed migrations errored and that later patches were needed. Therefore the deployed database remains **unverified** until a read-only Supabase catalog/history inspection is completed.

## Archive and source checks

| Check | Result |
|---|---|
| ZIP integrity (`unzip -t`) | PASS |
| Canonical migration files | 201 |
| Migration source manifest | PASS, 201/201 synchronized |
| SQL lexical integrity | PASS, 201 files; strings/comments/dollar quotes/parentheses balanced |
| Migration structural inventory | Generated for 201 files; source-only signals, not defect verdicts |
| Phase 23 migration integrity | PASS; 428 SECURITY DEFINER definitions checked by the dedicated gate |
| Run249 wallet recovery/build guards | PASS, 24/24 |
| Security audit | PASS, 34/34 |
| Independent marketplace/community audit | PASS, 42/42 |
| Phase 24 release review | PASS |
| Phase 26 wallet-ledger resilience | PASS, 17/17 |
| Full `npm run verify:static` | PASS, exit 0 |

The structural inventory scanner reports 457 SECURITY DEFINER occurrences in its broad source inventory. The dedicated Phase 23 gate checks 428 definitions against its stricter recognition rule. These are different scanner counts and must not be presented as interchangeable.

## Verification blocked by environment

The project and lockfile require Node `^24.15.0`; this runtime provides Node `22.16.0` and npm `10.9.2`. The project correctly rejects the unsupported runtime:

- `npm run typecheck`: BLOCKED by the Node version precheck.
- `npm run lint`: BLOCKED by the Node version precheck.
- `npm run build`: BLOCKED by the Node version precheck.
- Dependency-backed type/lint/build results are therefore **not available**. No passing claim is made for these commands.
- No PostgreSQL server/client, disposable PostgreSQL rehearsal, or live Supabase project connection was available during this source review.

## Database and migration disposition

1. The user's report is that migrations 1–189 were manually executed in Supabase SQL Editor, with some errors and later patches. This is an operator-reported history, not independently verified catalog state.
2. Do not rerun migrations 1–189 wholesale. First inspect the actual schema and migration history.
3. Do not bulk-apply migrations 190–201. Inventory classification is not deployment approval.
4. Migration 193 (`20261107170001_phase7_durable_community_governance.sql`) is classified REQUIRED in the current generated checklist, but still requires dependency, schema and target-history review before application. `REQUIRED` does not mean safe to execute blindly.
5. Migrations 190–192 and 194–201 remain held for individual review. Migrations 200–201 must not be considered independently of their wallet-recovery prerequisites.
6. Testnet and Mainnet histories must be reconciled separately. Never infer one environment's state from the other.
7. No SQL was executed against Supabase; no remote schema, user data, balances, ledger entries, payout requests or provider state was changed.

## Known documentation drift

Some historical audit documents packaged in the archive describe older baselines (198 or 199 migrations, earlier release versions and older review counts). They are historical records, not current Run249 totals. The current canonical inventory and generated checklist are the source for the 201-file count. This review is the current Run249 source-integrity summary; historical audit documents are intentionally preserved rather than silently rewritten.

## Required closure evidence

The database portion cannot be truthfully marked complete until all of the following are obtained:

- Read-only Testnet migration-history output, if the Supabase migration-history relation exists.
- Read-only catalog inventory of tables/columns, constraints, indexes, triggers, views/functions, RLS policies and effective grants.
- Comparison of live catalog objects with the source definitions for migrations 1–189, including patches that were applied manually after failures.
- A per-migration reconciliation: already present and correct; partially applied; missing; superseded; or unsafe/conflicting.
- Clean PostgreSQL rehearsal of each genuinely pending migration and dependency chain before any approved Testnet application.
- Node 24.15.0 dependency-backed typecheck, lint and production build, followed by authenticated two-account Testnet acceptance for financial and security-sensitive journeys.

**Safety rule:** Do not use `supabase db push`, migration repair, bulk SQL paste, manual balance edits, or direct financial-row repairs as a shortcut to make history appear complete. Any corrective SQL must be generated from verified live catalog evidence, reviewed, backed up, and applied individually with an explicit operator decision.
