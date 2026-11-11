# GreenHaven release manifest — 0.338.54

- Run: #291 — Production Readiness / Pi Earnings Recovery Safety
- Date: 2026-11-11
- Baseline: RUN272 / 0.338.53
- Scope: Pi earnings reservation-release safety, build-footprint diagnostics, release-truth updates.

## Changes

1. Restrict user-facing self-service release to never-started Pi Testnet reservations with no provider payment ID, txid, receipt, verification, execution start, lease token/expiry, or execution attempts.
2. Keep `processing` and `uncertain` reservations held until authoritative provider reconciliation; a missing persisted provider ID is not proof that no payment exists.
3. Clear both execution lease fields when a safe unstarted reservation is released.
4. Add 15 static regression checks for SQL safety, server-only ACL, authenticated/rate-limited route and accurate wallet messaging.
5. Add a non-blocking postbuild workspace-footprint report to identify large Vercel build directories and files.
6. Update migration classification and current production-readiness evidence.

## Verification

- Run #291 payout-release safety contract: 15/15 passed locally.
- Build-footprint reporter: executed locally; source tree measured 16.5 MB excluding `.git` and `.vercel` (dependencies and `.next` absent locally).
- Baseline 0.338.53: both Vercel Preview deployments READY on commit `3ae3524d364d737ae98c2d2c764c7ef282c8acda`; Node 24.22.2; 315 prebuild checks invoked; Next build completed.
- 0.338.54: Vercel Preview build, full Node 24 typecheck/lint, browser/device acceptance and Supabase migration postflight are pending.

## Database and financial safety

- No migration applied in this increment.
- No payout, payment, reservation, ledger, balance or entitlement changed.
- Three Testnet `uncertain` earnings requests (3.00 π gross total) remain held pending authoritative Pi provider reconciliation.
- Mainnet Supabase is inactive and untouched.

## Release decision

**NOT APPROVED for production.** The current Vercel projects are Preview deployments (`target: null`, `live: false`). Mainnet Supabase is inactive. Production approval requires a successful 0.338.54 Preview build, exact migration-history reconciliation, Pi provider reconciliation and funded Testnet A2U acceptance, full browser/Android/Pi Browser/two-account testing, and a separate Mainnet launch review.
