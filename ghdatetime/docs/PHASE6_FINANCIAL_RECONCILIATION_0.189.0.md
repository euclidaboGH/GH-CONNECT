# Phase 6 — Financial reconciliation and observability (0.189.0)

## Goal
Provide an authenticated, read-only view that detects inconsistencies across financial snapshots without inventing balances or writing financial entries.

## Delivered
- Compare `gh_earnings_balances` with `gh_earnings_withdrawable` for available and reserved PI atomic units.
- Validate atomic values as bounded integer strings/safe integers; do not compare through floating point.
- Probe `gh_pi_cashback_user_statement` directly with the authenticated user ID and privileged server credentials. A missing RPC, malformed response, invalid amount or timeout is reported as unavailable, never as zero or enabled.
- Report `healthy`, `attention` or `degraded` independently from request transport success.
- Surface reconciliation status and attention findings in the unified earnings dashboard.
- Preserve charity segregation and PI/GHC asset separation.

## Security and accounting boundaries
- User-scoped authenticated GET; no client-provided balances or identifiers.
- Read-only; no ledger writes, payout transitions, provider actions or reservation releases.
- No database migration introduced.
- Cashback payout reservations are not represented as zero when the payout-status source is unavailable; statement availability and payout availability remain separate concerns.

## Verification
- `node scripts/check-phase6-financial-reconciliation.mjs` — 12/12 source-contract checks.
- Full PostgreSQL, Supabase Testnet and browser E2E validation remain required.
