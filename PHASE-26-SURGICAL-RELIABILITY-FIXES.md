# GH-CONNECT v0.90.8 — Surgical reliability fixes

## Changes
- Fixed the wallet refresh effect dependency so it tracks the authoritative wallet refresh callback without suppressing the React Hooks dependency contract.
- Memoized match filtering sets and mutual-match derivation; made the `likesYouRows` memo dependencies explicit while preserving block and mutual-match filtering behavior.
- Updated GitHub Actions checkout and setup-node actions to v5, which use the newer Node runtime expected by the current CI platform; pinned the runner to `ubuntu-24.04` to avoid an unreviewed `ubuntu-latest` OS migration.
- Added review-required migration `20261025010001_gh_community_create_idempotency_guard.sql`: same-owner retries are idempotent, while an existing community ID cannot be claimed by another owner. This migration is **not applied** to any database; reconcile target history and test it on disposable PostgreSQL/Testnet before deployment.
- Synchronized release metadata to v0.90.8.

## Verification scope and limitations
- The previous v0.90.7 deployment was reported by the user as passing Next.js compilation, TypeScript validation, and static page generation.
- The local environment has Node.js 22.16.0 while the project pins Node.js 24.15.0; therefore, do not treat local production build results as equivalent to the production Node 24 build.
- A fresh `npm audit` could not reach the npm registry in this environment (`EAI_AGAIN`). The earlier reported 16 advisories are not considered fixed by this release. No force-upgrade or lockfile rewrite was performed.
- Live Pi/GHC testnet payments, wallet settlement, and community fee recovery require a connected testnet environment and were not certified here. Community fee settlement and community creation are still separate server operations; this release does not claim to make them one atomic transaction.

## Safety constraints retained
No client-side financial authority, fabricated balances/rewards/transactions, auth bypass, RLS bypass, or unreviewed database migration was introduced.
