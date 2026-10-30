# Phase 2 — Registration bonus reconciliation and ledger hardening

Release work version: `0.180.0`  
Source baseline: `GH-CONNECT-0.179.0-REGISTRATION-BONUS-0.05PI-2026-10-29.zip`  
Environment target: **Testnet only**

## Implemented in source

- Registration bonus policy is 3 PI (`30,000,000` atomic units at `1e-7` PI).
- Existing users with an authoritative `registration_bonus:v1:<userId>` ledger entry are eligible for a separate 2.95 PI (`29,500,000` atomic units) top-up.
- New/eligible users without prior bonus entries can claim 3 PI through the authenticated server route.
- Full-bonus and top-up references are distinct and idempotent. The database claim RPC serializes requests per user and delegates posting to `gh_earnings_post_credit`.
- Status uses direct ledger lookups rather than a paginated statement.
- The schema migration defines service-role-only RPCs but does not bulk-credit users on migration apply.
- The explicit operator SQL script previews legacy claimants, runs the idempotent reconciliation, fails the transaction on any failed user, and provides a post-check. It must only be run after verifying the target is the intended Testnet Supabase project.
- Bonus claims fail closed unless `GHC_REGISTRATION_BONUS_ENABLED=1` and `NEXT_PUBLIC_PI_SANDBOX=true`. Mainnet or an unconfigured network is not enabled by default.

## Static validation

- Registration bonus checks: 18/18.
- Phase 2 reward/payment contract checks: 10/10.
- JSX safety scan: passed (855 files).
- Database contract source: 125 executable tables across 154 canonical migrations.
- SECURITY DEFINER source audit: 321 declarations have fixed search paths and matching PUBLIC execute revokes.
- Clean migrations: 154 unique migrations.
- Migration inventory: synchronized.
- Release hygiene: 11/11.
- Unified wallet card static checks added in this release.

## Operational gates still required

Static checks do not prove deployed database state. Before calling Phase 2 operationally complete:

1. Use Node `24.15.0` or later and run the complete typecheck/build in CI.
2. Compare the Testnet `supabase migration list` with the repository before applying the new migration.
3. Apply `20261030010001_registration_bonus_v2_reconciliation.sql` to Testnet only.
4. Review and run `scripts/ops/phase2-registration-bonus-backfill-testnet.sql` on Testnet only.
5. Verify legacy users receive exactly 2.95 PI once; eligible unclaimed/new users can claim 3 PI once; repeated/concurrent claims do not duplicate credits.
6. Verify PI withdrawal network configuration and wallet authorization; keep Mainnet withdrawals disabled until official Mainnet configuration and end-to-end evidence are approved.

Do not report database migration, backfill, deployment, or live withdrawal testing as completed until the corresponding evidence exists.
