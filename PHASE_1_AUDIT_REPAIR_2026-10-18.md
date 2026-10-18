# Phase 1 — Audit Repair and Reproducible Build Readiness

**Candidate:** GH-CONNECT 0.61.1
**Audit date:** 2026-10-18
**Status:** Source-level audit repairs applied; clean dependency install and full build remain blocked in this environment.

## Changes in this increment

1. Added `scripts/generate-migration-inventory.mjs` to generate `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt` from the canonical `supabase/migrations/*.sql` directory. It supports a read-only `--check` mode and a read-only `--list` mode.
2. Reconciled the inventory to 90 SQL migrations and the explicit classifications: 69 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 18 REVIEW_REQUIRED. These are repository classifications, not instructions to apply migrations.
3. Replaced the old migration checklist printer with a wrapper around the generated canonical inventory so it no longer reports review-required files as ordinary REQUIRED migrations.
4. Corrected the stale migration count in `docs/PHASE_IMPLEMENTATION_STATUS.md` and updated the historical migration-gap report to clearly label its 70-file count as an older snapshot.
5. Changed `.env.example` so `NEXT_PUBLIC_MESSAGING_DURABLE=false` by default. Activation guidance now requires the reviewed Testnet migration, two-user IDOR and delivery E2E gates first.
6. Tightened `.github/workflows/ci.yml`: on the `testnet` branch, browser E2E and operator HTTP smoke now fail if `GHC_E2E_BASE_URL` is missing. Pull-request skips are explicitly not release evidence.
7. Added `scripts/test-phase1-release-readiness.mjs`, wired the migration-inventory check and Phase 1 guardrail test into `ci:verify` and CI.

## Verification executed

- 87 `scripts/test-*.mjs` regression scripts: **87 passed, 0 failed**.
- Phase 1 release readiness: **10/10 passed**.
- Release hygiene: **10/10 passed**.
- Deployment network safety: **10/10 passed**.
- Generated inventory consistency: passed; 90 migration files and classifications match the generated docs/manifest.
- Migration chronology guard: passed its hard checks and still flags 10 future-dated migration files for manual review.
- Package/lockfile version consistency: 0.61.1 / 0.61.1.

## Blockers / not verified

- `npm ci --legacy-peer-deps` did not complete in the environment; registry access stalled. An offline retry failed because the required `zod@3.25.67` package is not cached.
- The available Node runtime is `v22.16.0`, below the project's declared supported ranges `^22.22.2 || ^24.15.0`. CI is configured for Node 24.15.0.
- Therefore full TypeScript typecheck, ESLint, Next.js production build and browser E2E have **not** been verified here.
- No PostgreSQL/Supabase connection was available. No migration was applied, and no Testnet/Mainnet schema or migration history was queried.
- No GitHub push, Vercel deployment, Pi transaction or production activation occurred.

## Next required steps

1. Run the exact candidate under supported Node 24.15+ in CI or a connected build environment.
2. Require a green clean install, typecheck, lint, full static suite and production build.
3. Configure `GHC_E2E_BASE_URL` for the Testnet branch and run browser/operator E2E.
4. Reconcile Testnet and Mainnet migration histories independently; validate migrations on disposable PostgreSQL before applying anything.
