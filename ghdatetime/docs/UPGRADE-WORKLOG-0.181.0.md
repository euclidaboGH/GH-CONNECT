# GH Connect upgrade worklog — 0.181.0

Date: 2026-10-30

## Phase 3 unified wallet continuation

- Hardened the PI earnings panel with a bounded 10-second request timeout, latest-request-wins sequencing, explicit retry control, and server-derived payout eligibility / Pi identity linkage messaging.
- Added regression contracts for timeout behavior, stale-response suppression, eligibility, retry affordance, and identity linkage.
- Kept PI and GHC accounting and transaction history separate. No client-side balance mutation or external payment was added.
- Synchronized package, lockfile, app release, README, project truth, and verified migration inventory to version 0.181.0.

## Source-only verification

- `npm run verify:static` was attempted. Its first run exposed stale release-baseline documentation and a missing versioned worklog referenced by existing static checks. These release artifacts were updated; rerun the full suite after this update.
- Focused unified wallet contract, registration bonus contract, wallet cross-feature reconciliation, wallet transaction integration, payment-intent hardening, wallet authorization, security-header, API CSRF, database-contract, release-hygiene, project-truth, and production-safety checks passed before the final worklog/report synchronization.
- Production safety scan: 866 source files scanned, 21 checks passed, 0 failed.

## Verification limitations

This environment has Node.js 22.16.0 and no installed dependencies. The project requires Node.js 24.15.0 or later. TypeScript, lint, Next.js production build, browser/device acceptance, live Testnet payment tests, and database migration execution have not been completed. No Supabase migration or Vercel deployment was performed.

## Release safety

Do not interpret static source checks as proof of live database state or successful payout settlement. Reconcile Testnet migration history, validate on disposable PostgreSQL/Testnet, run supported-runtime CI, and verify the complete authorized payout/recovery path. Mainnet payout remains gated.
