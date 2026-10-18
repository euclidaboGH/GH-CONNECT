# GH-CONNECT Phase 2 — Full Project Audit and Remediation

**Package:** 0.61.0  
**Date:** 2026-10-18  
**Scope:** repository source and configuration contained in the supplied Phase 1 ZIP. This is not a live GitHub/Vercel/Supabase audit.

## Implemented in this phase

1. Added a safe `.env.example` covering every `process.env.NAME` reference found in `app/`, `lib/`, `components/`, and `middleware.ts`. Values are blank or local-safe placeholders; no credentials are included.
2. Added `scripts/test-deployment-network-safety.mjs`, which checks environment-template completeness, secret-prefix safety, Preview/Testnet vs Production/Mainnet readiness semantics, the CI wiring, and the documented Vercel environment matrix.
3. Fixed a readiness-gate classification bug: Vercel Preview deployments commonly run with `NODE_ENV=production` but should use Pi Testnet. The Pi network mismatch blocker now uses the actual Vercel Production target or explicit `GHC_ENV=production`, rather than `NODE_ENV` alone. Other production hardening, including disabling development auth in production-like runtime, remains fail-closed.
4. Added the network-safety test to the GitHub Actions workflow and `ci:verify` script.
5. Added the environment-template and secret-prefix checks to release hygiene.
6. Bumped package, lockfile, and app-release metadata to 0.61.0.

## Audit findings that remain release blockers

### P0 — database/migration state is not known

- The migration folder has 86 SQL files. That is an inventory, not evidence of applied state.
- Filenames dated `20261024...` are later than this audit date (2026-10-18). Do not rename or apply them automatically; verify their intended sequence and migration-history state with the operator first.
- `202610180004_curation_self_vote_guard.sql` and `202610180005_allow_self_curation.sql` intentionally supersede each other: the former blocks author votes; the latter re-allows self-curation as a display/encouragement signal. Verify this sequence on a clean local database and Testnet before applying.
- Testnet and Mainnet must be reconciled independently using Supabase migration history. Never run the whole folder blindly or modify Mainnet as part of this phase.

### P0 — complete reputation bridge remains gated

- Current reputation events are append-only, non-negative points; there is no safe general negative/compensating event path.
- GHPV settlement is idempotent per content and epoch, but an automatic settled-judgment-to-account-reputation bridge must not be activated until correction/reversal semantics are implemented and tested. Otherwise a later correction could leave incorrect permanent points.
- The 80/20 quality/reputable-activity vs social-interaction target is policy intent, not a fully integrated scoring pipeline. Verified session time, ad completion, video watch quality, and social event caps need authoritative event sources and anti-replay rules.

### P1 — abuse detection and allocation

- Self-curation is allowed by the later migration but must remain excluded from independent consensus, account reputation awards, and GHC incentives.
- Coordinated account, shared-device/identity, collusion, and suspicious reward-pattern detection remains incomplete. No automatic punitive decisions should be made from a single weak signal; use rate-limited risk events, review thresholds, auditability, and appeals.
- Privileged allocations must derive reputation, calibration, eligibility, and caps on the server. Client rank, wallet balance, raw likes, raw votes, ad-watch claims, or local storage are not authorities.

### P1 — live integration not verified

- No remote Supabase migration or query was executed.
- No Pi Developer Portal network/key pairing was verified.
- No live Pi authentication/payment/ads flow was exercised.
- No deployed Preview/Production environment was inspected; GitHub Actions E2E only runs against a URL when `GHC_E2E_BASE_URL` is configured.

### P1 — full build gates

- Static scripts can pass while TypeScript, ESLint, or Next.js build fails. Run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, and `npm run build` in CI using Node 24.15.0 before release.
- A passing static suite is not proof of load, concurrency, database RLS, or payment correctness.

## Deployment order

1. Review the source diff and archive the current deployed commit.
2. Run CI and a local clean migration reset using a disposable database.
3. Reconcile remote Testnet migration history; back up and apply only approved missing migrations to Testnet.
4. Run multi-account Testnet checks: Pi sign-in, U2A approval/completion, duplicate callback, membership fulfilment, wallet ledger, self-curation exclusions, vote toggles, rewards idempotency, messaging permissions, and RLS/IDOR boundaries.
5. Verify health/readiness reports correct `sandbox-testnet` on Preview and `mainnet` on Production without exposing credentials.
6. Only after sign-off, plan Mainnet migration separately with a backup, reviewed diff, and rollback/forward-fix plan.

## Changes not made

No GitHub push, Vercel deployment, Supabase migration, production credential access, payment, or wallet mutation was performed. Mainnet remains untouched.
