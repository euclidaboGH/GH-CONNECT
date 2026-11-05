# Phase 3 — Unified PI Earnings Ledger Hardening

## Scope

This additive release hardens the existing unified PI earnings ledger. It does not replace prior migrations, alter historical entries, authorize any wallet, execute a payout, or enable payout execution.

## Changes

- Ledger rows are append-only. `UPDATE` and `DELETE` are rejected; corrections must be represented by compensating entries.
- Credit writes are serialized per GreenHaven user and idempotency retries must match the original entry type, amount, source kind, status, source table, and source ID.
- Reservation, settlement, and release retries are bound to the exact atomic amount and payout request ID.
- Financial mutations use the same per-user transaction advisory lock so concurrent writes cannot race the ledger balance.
- Cashback A2U execution now stops before creating/submitting a Pi transfer if the unified-ledger credit or reservation fails.
- A retry for an already-paid cashback request repairs/checks the unified-ledger settlement before returning an idempotent success.

## Atomic units and balances

PI is stored as integer atomic units at a scale of `10,000,000` (1 PI = 10,000,000 atomic units). User-visible balances remain derived from ledger entries; client-supplied balances are never accepted as write authority.

## Apply and release controls

Migration `20261105170001_phase3_earnings_ledger_integrity_hardening.sql` is classified `REVIEW_REQUIRED`. Reconcile migration history on the **Testnet Supabase project only**, inspect the SQL, and apply this migration individually after a disposable-database test. Do not bulk-push migrations. Mainnet remains untouched.

Keep `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=false` until wallet-consent, Testnet funding, payout idempotency, provider receipt verification, settlement, cancellation/release, and reconciliation tests all pass. This change does not change that flag.

## Verification

Run:

```bash
node scripts/check-phase3-unified-earnings-ledger.mjs
node scripts/check-migration-source-manifest.mjs
node scripts/check-phase23-migration-integrity.mjs
node scripts/generate-migration-inventory.mjs --check
```

These are repository/static checks. They do not execute SQL against Supabase or prove live Pi Testnet payment behavior.
