# Mainnet migration reconciliation — live Run #302 evidence

**Source release:** GreenHaven 0.338.86 / Run #302  
**Audit date:** 2026-11-16  
**Mainnet project:** `rrrtjowuldcpbjobbpic` (GH Connect Mainnet Supabase, `eu-west-1`)  
**Testnet project:** `tpckwgdsjlkzscjlxiwe` (GH Connect Testnet Supabase, `eu-west-1`)  
**Current decision:** **HOLD — Mainnet bootstrap is not approved.**

## Live read-only snapshot

- Mainnet Supabase migration history: 0 records.
- Mainnet `public` application tables: 0.
- Mainnet PostgreSQL: 17.6.1.166.
- Testnet Supabase migration history: 43 records.
- Testnet PostgreSQL: 17.11.0.003.
- Exact Testnet history source matches in the current 224-file archive: 12.
- Testnet history rows without exact local `(version, name)` source files: 31.
- Testnet Run #302 migration `20261116045934_pi_wallet_scope_consent_provider_address_discovery` is present and applied to Testnet only.
- Two later Testnet feed-preference records (`20261116054218`, `20261116054242`) are not present as exact files in this source archive. The older local feed-preference migration is not a substitute for either exact history record.

See `../docs/RUN302-MAINNET-MIGRATION-RECONCILIATION-2026-11-16.md` and `../docs/RUN302-TESTNET-MIGRATION-HISTORY-RECONCILIATION.csv` for the detailed evidence.

## Required release controls

- Do not run `supabase db push` against Mainnet while the canonical directory contains unresolved or held migrations.
- Do not run the generated `GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` as a bootstrap: it currently includes every migration, including held and proposal SQL.
- Do not delete, squash, rename, or manually repair migration history to make the local and remote counts agree.
- Recover exact Testnet historical SQL, preserve it separately from fresh-install candidates, and classify every source/version mismatch.
- Resolve the 102 `REVIEW_REQUIRED`, one `REQUIRES_APPROVAL`, and two `PROPOSAL` files. `REQUIRED` means candidate for review, not approved for automatic application.
- Rehearse a complete install on disposable PostgreSQL 17, including RLS, grants, SECURITY DEFINER ACLs, financial invariants, concurrency and recovery tests.
- Generate a separate Mainnet bootstrap installer only from individually approved and successfully rehearsed migrations.
- Verify backup/restore, change ownership, rollback/recovery procedures and explicit production approval before any Mainnet DDL.

## Mainnet security-advisor note

The live Mainnet security advisor reports `public.rls_auto_enable()` as a SECURITY DEFINER function executable by `anon` and `authenticated`. Inspection shows it is owned by `postgres`, has `search_path=pg_catalog`, and is attached to the enabled `ensure_rls` DDL event trigger. This event-trigger function must be reviewed in its trigger/platform context; do not drop it or treat the linter finding alone as proof of an ordinary callable RPC. No change was made during this audit.

## Reconciliation record

| Field | Verified result |
|---|---|
| Mainnet project reference | `rrrtjowuldcpbjobbpic` |
| Mainnet migration history | 0 rows |
| Mainnet public application tables | 0 |
| Mainnet PostgreSQL version | 17.6.1.166 |
| Testnet project reference | `tpckwgdsjlkzscjlxiwe` |
| Testnet migration history | 43 rows |
| Exact local Testnet source matches | 12 / 43 |
| Testnet source/version mismatches | 31 / 43 |
| Backup/restore verification | Not performed in this audit |
| Disposable PostgreSQL clean replay | Not performed in this audit |
| Production approval | Not granted |
| Deployment decision | **HOLD** |

No Mainnet migration was applied by this audit.
