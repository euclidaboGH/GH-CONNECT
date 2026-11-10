# Mainnet migration reconciliation — independent operator guide

**Source release:** 0.338.13  
**Audit date:** 2026-11-09  
**Current state:** NOT RECONCILED

This guide is intentionally separate from `supabase/TESTNET_APPLY_ORDER.md`. Mainnet history must be collected and evaluated independently. Never infer Mainnet state from Testnet.

## Required evidence

- Confirmed Mainnet Supabase project reference and production environment identity.
- Read-only remote `supabase_migrations.schema_migrations` export.
- `supabase migration list --linked` output after explicitly linking to the Mainnet project.
- PostgreSQL version and schema/catalog evidence for remote-only or divergent migrations.
- Verified, restorable backup and documented recovery owner.
- Production change approval and maintenance/rollback plan.

## Comparison rules

Compare remote versions with the local canonical inventory (199 migrations in source release 0.338.13). Record each as matched, local-pending, remote-only, renamed, source-drifted, failed/partial, or schema-drifted. Preserve the raw evidence. Do not modify remote history to make it resemble local files until the cause and safe repair have been reviewed.

## Application restrictions

- Do not run `supabase db push` while any pending migration is held as `REVIEW_REQUIRED`, `REQUIRES_APPROVAL`, or `PROPOSAL`.
- `REQUIRED` means candidate for individual review, not automatic approval.
- Validate every approved migration on disposable PostgreSQL first.
- Apply one approved migration at a time under the production change plan.
- Run feature-specific postflight, RLS/grant checks, financial invariants and recovery tests.
- Record applied version, name, source hash, operator, approval, timestamp and postflight evidence.
- Stop immediately on any unexpected remote-only version, source drift, schema mismatch or failed migration.

## Reconciliation record

| Field | Mainnet evidence |
|---|---|
| Project reference | Not supplied / not connected |
| Remote migration export | Not collected |
| CLI linked status | Not collected |
| PostgreSQL version | Not collected |
| Backup/restore verification | Not collected |
| Version comparison | Not performed |
| Divergences resolved | None verified |
| Production approval | Not granted |
| Deployment decision | **HOLD** |

**No Mainnet migration has been applied or verified by this guide.**
