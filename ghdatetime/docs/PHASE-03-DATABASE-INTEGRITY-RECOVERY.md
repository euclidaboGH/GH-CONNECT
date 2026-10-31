> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 03 — Database Integrity and Recovery

**Scope:** establish a safe, repeatable database backup/restore process and migration rehearsal discipline. This document and its helper scripts do not connect to or modify a database. No production backup, restore, or migration has been run by this change.

## Critical distinction

`lib/backup-recovery.ts` stores app-level snapshots in an in-memory manager and captures selected profile/settings/posts/conversations data. It is not a durable PostgreSQL backup, does not include the full relational database, and does not demonstrate disaster recovery. A browser/app snapshot must never be presented as a database restore point.

## Backup creation (operator-run)

Use a secured operator workstation or approved backup runner with the intended database URL supplied through the environment/secret manager. Never put credentials in shell history, logs, documentation, or command-line arguments. Example with `pg_dump` configured through standard libpq environment/credential files:

```sh
umask 077
pg_dump --format=custom --no-owner --no-acl --file="$BACKUP_DIR/greenhaven-$(date -u +%Y%m%dT%H%M%SZ).dump" "$DATABASE_URL"
```

The destination must be encrypted at rest, access-controlled, outside the database failure domain, and governed by a documented retention policy. Confirm provider-managed point-in-time recovery and retention settings independently; this repository cannot verify them.

## Artifact verification

```sh
node scripts/verify-database-backup-artifact.mjs "$BACKUP_FILE" --max-age-hours=24 --min-bytes=1024
```

The verifier checks file presence, size, age, SHA-256, and whether `pg_restore --list` can read the custom-format archive. Save the digest and verification output with the backup record. **Catalog readability is not proof of recoverability.** The script intentionally does not connect to a database or perform a restore.

## Mandatory isolated restore drill

1. Provision a disposable PostgreSQL instance matching the production major version and required extensions; isolate networking and use synthetic/non-sensitive data where possible.
2. Restore only into that disposable target. Keep production credentials unavailable to the drill environment.
3. Record PostgreSQL and extension versions, dump digest, start/end timestamps, errors, row/table counts, and validation query results.
4. Check critical invariants: required tables/functions/indexes exist; RLS is enabled where expected; security-definer function owners/search paths/grants match policy; key foreign keys and unique constraints validate; representative ledger sums and payment/transfer state relationships reconcile without exposing personal data.
5. Run application smoke tests against the isolated restored database, including read paths and a controlled rollback-safe financial transaction fixture.
6. Measure elapsed restore and validation time. A drill passes only if all checks are recorded and an independent operator reviews the evidence.
7. Destroy the disposable environment and securely handle dump copies according to retention policy.

**Never rehearse a restore against production.** Do not run `supabase db push` as a substitute for migration reconciliation or restore testing. Reconcile migration history independently for each target before applying any SQL; proposals and `REVIEW_REQUIRED` migrations are not auto-approved.

## Recovery objectives and evidence

Proposed starting targets only; the service owner and operations team must approve them before they become commitments:

- **RPO:** 24 hours maximum data loss for a scheduled-dump-only fallback; provider PITR may support a tighter objective if enabled and tested.
- **RTO:** 4 hours to restore service from a verified backup, including integrity checks and application smoke tests.

These are not measured achievements. Record actual backup cadence, last successful dump, last successful isolated restore, achieved RPO/RTO, alert owner, escalation route, and exceptions in the deployment evidence pack. If the business requires tighter objectives, configure and validate a suitable PITR/replication strategy instead of assuming these targets are met.

## Migration integrity gates

- Check unique migration version prefixes and inventory drift before rehearsal.
- Compare local migration versions with the target project's migration history; never infer applied status from filenames.
- Replay the reviewed migration set into a clean disposable database and separately rehearse upgrades from a representative prior schema snapshot.
- Capture failures and resulting schema diff; inspect destructive changes, grants, RLS, function search paths, and dependent callers.
- Use a reviewed rollback/forward-repair plan. Do not promise that arbitrary SQL migrations are automatically reversible.
- No production application, migration, restore, or payment setting changes are authorized by Phase 3 source changes alone.

## Current status

The repository contains an artifact verifier, source regression contracts, and this operator runbook. After restoring to the disposable target, run `supabase/VALIDATE-RESTORED-DATABASE.sql` using a read-only database role. It fails closed if required identity/financial tables are missing, GreenHaven tables lack RLS, or `SECURITY DEFINER` functions are executable by `PUBLIC` or lack a pinned `search_path`; it also reports unvalidated foreign keys and invalid indexes for explicit review. The SQL is read-only and must never be used as a substitute for synthetic financial reconciliation or application smoke tests.

Actual backup creation, restore rehearsal, provider PITR configuration, RPO/RTO measurement, and production migration-history reconciliation remain operator tasks and are not claimed complete.

## Machine-checked restore evidence

Use `docs/PHASE-03-RESTORE-EVIDENCE-TEMPLATE.json` to record a real drill without storing secrets or personal data. The template deliberately starts in a failing state. After replacing placeholders with observed evidence, run:

```sh
node scripts/validate-database-restore-evidence.mjs docs/PHASE-03-RESTORE-EVIDENCE-TEMPLATE.json
```

The validator checks evidence completeness, the disposable-environment declaration, absence of production credentials, backup SHA-256 shape, timestamps, integrity checks, application smoke tests, RPO/RTO measurements, and independent review. It rejects failed or unrun checks. It does not prove that the reported events happened; independent review and raw, redacted operator logs remain required. Do not place database URLs, tokens, passwords, service-role keys, or personal data in the evidence file.


## Evidence validator safety additions

The evidence validator rejects non-object JSON and input larger than 256 KiB before parsing, requires timezone-qualified timestamps with valid calendar dates, validates the PostgreSQL version format, requires the independent review timestamp to be at or after restore completion, and requires measured non-negative RPO and RTO for any report claiming a passing restore. Run `npm run test:database-restore-evidence` to exercise accepted evidence and failure cases (incomplete checks, missing measurements, credential fields, invalid digest, malformed timestamps and PostgreSQL versions, malformed top-level JSON, and oversized input). These are validator behavior tests only; they do not constitute a real restore drill.


## Recovery-track Phase 4 handoff

Phase 4 adds a single offline contract runner and a fail-closed release command that requires evidence from a real disposable PostgreSQL restore drill. See `docs/PHASE-04-RECOVERY-RELEASE-GATE.md`. The historical product Phase 4 identity-integration feature is separate.
