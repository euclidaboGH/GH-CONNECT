# GreenHaven 0.338.54 — Run #291 Production Readiness Safety Increment

Source baseline: `0.338.53` RUN272 archive  
Current source: `0.338.54`  
Date: 2026-11-11

## Implemented

1. Hardened `20261111120001_pi_earnings_release_stale_incomplete.sql`: the user-facing self-service release path now permits only never-started `reserved` Pi Testnet requests with no provider payment ID, txid, receipt or verification, no execution start, no lease token/expiry and zero execution attempts.
2. Processing and uncertain requests remain reserved until authoritative Pi provider reconciliation. An old worker timestamp or missing persisted provider ID is not proof that no Pi payment was created.
3. Safe release clears both execution lease fields and continues to call the atomic `gh_earnings_release_reserve` ledger function.
4. Added a 15-check regression contract covering SQL release safety, provider evidence, lease state, service-role-only function ACL, authenticated/rate-limited API route and accurate wallet copy.
5. Added a non-blocking postbuild workspace-footprint report to identify large directories/files in Vercel's build workspace.
6. Updated the current source version, in-app release metadata, source-of-truth pointers, migration inventory and Testnet apply order. The payout migration is classified `REVIEW_REQUIRED` and remains unapplied.

## Verification

This is a source-only verification record; it does not claim a successful full runtime build for 0.338.54.

- Run #291 payout-release safety: 15/15.
- Phase 1–10 upgrade pack: 20/20.
- Project truth: 11/11.
- Release hygiene: 15/15.
- Phase 12 final integration/release readiness: 28/28.
- Full `npm run verify:static`: rerun after the final source/documentation updates; Node 22.16.0 is below the required Node 24.15.0 runtime for full prebuild/typecheck/lint/build.
- Baseline 0.338.53: both connected Vercel Preview builds are READY on commit `3ae3524d364d737ae98c2d2c764c7ef282c8acda`, Node 24.22.2, with 315 prebuild checks invoked and the Next.js build completed. This does not prove the new 0.338.54 source has built.

## Live platform and financial boundaries

- Supabase Testnet was inspected read-only. No migration, payout, reservation, ledger, balance or entitlement was changed.
- Three Pi Testnet earnings requests remain `uncertain`, totalling 3.00 π gross, with no persisted provider payment ID, txid or active lease. They must remain held until Pi's authoritative provider state is reconciled.
- Mainnet Supabase is inactive and untouched. Vercel latest deployments are Preview-only. Production remains NOT APPROVED.
- Dependency deprecations for DOMPurify, transitive Stellar packages through `pi-backend@0.1.3`, and ESLint 9 remain open for compatibility-tested lockfile migrations; no blind overrides were made.

## GitHub integration result

A branch creation request for `run-291-production-readiness` from the verified `testnet` commit was rejected with HTTP 403 (`Resource not accessible by integration`). No remote branch, commit, pull request or Vercel deployment was created. The complete 0.338.54 source is preserved in the generated archive for review/import.

## Next gates

1. Push the 0.338.54 source to a non-production branch and verify Vercel Preview + GitHub CI.
2. Inspect the postbuild footprint report against the 4,865 MB Vercel source-footprint measurement.
3. Reconcile Testnet migration history before applying the one reviewed payout-recovery migration.
4. Reconcile the three uncertain Pi requests with the provider; do not retry or release them solely because the local provider ID is missing.
5. Run Node 24.15.0 dependency-backed typecheck, lint, build and browser/device/two-account acceptance.
6. Keep Mainnet disabled until a separate operator release review.
