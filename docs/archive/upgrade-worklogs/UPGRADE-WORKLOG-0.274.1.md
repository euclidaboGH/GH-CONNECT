> **LEGACY VERIFICATION FIXTURE** — superseded by current package worklog; retained for audit trail only.

# Upgrade worklog — 0.274.1

## Withdrawals health 42703 investigation & fix

### Failing probes (0.274.0)

1. `gh_earnings_quote_withdrawal` called with only `p_user_id` — function signature is `(text, numeric)`; incomplete probe was incorrect.
2. Earnings fallback `select=id` on `gh_earnings_ledger_entries` — service_role is **REVOKED** on that table; not a valid readiness probe.
3. Fee-aware `gh_earnings_withdrawable` references `gh_earnings_payout_policy.fee_bps` (migration `20261029010011`). If function body is applied without `fee_bps` column, PostgreSQL raises **42703**.

### Fixes

- Probe only `gh_earnings_withdrawable` and `gh_earnings_balances` with correct argument shapes.
- Parse PostgREST errors for SQLSTATE **42703** and return `SCHEMA_UNDEFINED_COLUMN` (never suppress).
- Auth table probe selects `gh_user_id` (canonical column).
- Idempotent migration `20261101140001_ensure_earnings_payout_policy_fee_bps.sql` (REVIEW_REQUIRED).

Source-level / source-only verification only. Supported runtime: Node.js 24.15.0. Apply migration on disposable DB then Testnet before treating withdrawals as schema-ready.
