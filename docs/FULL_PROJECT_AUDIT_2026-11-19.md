# Greenhaven full-project audit — 2026-11-19

## Scope and baseline

This audit reviews the complete source tree in the 0.338.108 Testnet Safe Upgrades candidate. It covers application source, feature modules, API routes, shared libraries, UI components, Supabase migrations/proposals, CI, Vercel configuration, environment templates, package scripts, and existing regression checks. It is a source-only review; it does not certify a live Supabase project or provider account.

Repository inventory at audit time:

- 301 files under `app/`
- 216 files under `components/`
- 38 files under `features/`
- 611 files under `lib/`
- 13 context files and 6 hook files
- 231 canonical SQL migration files
- 12 E2E files
- 613 script files
- 280 API route files and 368 exported HTTP methods
- 1,193 files scanned by the production-safety scanner

## Changes made in this audit derivative

1. Added `scripts/check-project-script-integrity.mjs` to verify that npm script chains do not repeat an identical command and that repository-local script references exist.
2. Registered that check at the start of `npm run verify:static`.
3. Removed the duplicate invocation of `scripts/check-run288-type-safety.mjs` from the `pretypecheck` chain. Its first invocation remains; the check was not removed from the suite.
4. Preserved all 231 historical migrations unchanged. No SQL migration was deleted, rewritten, reordered, or applied.
5. Preserved fail-closed financial and operator defaults. A feature being present in source is not authorization to enable real payouts, withdrawals, transfers, or reward issuance.

## Verification performed

Passed:

- Full `npm run verify:static` on the available Node 22.16.0 runtime: exit 0; more than 5,200 passing assertion/output lines.
- Migration integrity: 231 files, 231 unique 14-digit versions, 231 unique SHA-256 digests, 231 unique basenames; review proposals remain outside canonical migrations.
- Release hygiene: 21/21.
- Project truth and migration inventory synchronization: 11/11.
- API route/access audit: 10/10; 280 route files, 186/186 mutating routes assigned an owner, 90/90 direct fetch call sites bounded.
- API timeout/error/rate-limit hardening: 21/21.
- Separate Testnet/Mainnet readiness gates: 12/12.
- RLS source coverage: 176 executable table names have explicit RLS enablement; 139 tables have policy definitions and 37 no-policy tables are explicitly allowlisted for operator/service-role review.
- SECURITY DEFINER source audit: 492 declarations include `SET search_path` and a matching PUBLIC execute revoke.
- Production-safety scan: 21/21; 1,193 source files scanned with no public-prefixed privileged key names or client-side server credential reads detected.
- Security headers: 7/7.
- JSX safety: 1,177 files scanned.
- Dependency lock coverage and root package version consistency.
- New npm command-manifest integrity: 1,209 command entries checked, no duplicate commands or missing local script references.

## Findings and safer options

### Dependency security remains a release blocker

The current project-truth record reports 22 dependency advisories (1 critical, 13 high, 6 moderate, 2 low). A fresh `npm audit` attempt could not reach `registry.npmjs.org` from this environment (`EAI_AGAIN`), so the current advisory set and patched versions could not be independently refreshed. Do not apply blind `npm audit fix` or force upgrades. On a registry-connected Node 24.15.0 runner, refresh the audit JSON, group transitive findings by root dependency, update within supported semver ranges first, then test breaking upgrades separately and regenerate the lockfile deterministically.

### Required toolchain checks remain outstanding

The project pins Node 24.15.0 (`.nvmrc` and `engines.node`). This workspace provides Node 22.16.0 and has no installed `node_modules`. The full static suite passes, but dependency-backed `npm ci`, TypeScript, ESLint, Next.js production build, and Playwright browser/device runs were not executed here. CI is configured to run Node 24.15.0, install from the lockfile, run static checks, RLS/ACL checks, typecheck, lint, safety scan, and build.

### Database and financial prerequisites remain gated

The source truth records review-only SQL proposals for the atomic global reward allocator and curation redistribution idempotency, and durable daily GHPV calibration-cap state remains a prerequisite for automated settlement. These should be implemented as forward-only migrations only after disposable PostgreSQL rehearsal, idempotency/concurrency tests, ledger invariants, and target-history reconciliation. Do not enable reward issuance or automated settlement by setting flags alone.

### Testnet feature activation is conditional

Testnet UI and non-financial workflows can be exercised with isolated Preview configuration. Actual Pi A2U, Paystack transfers, withdrawals, seller payouts, reward settlement and other value-moving operations must remain operator-gated, use Testnet credentials/funding, enforce idempotency and limits, and require provider/database readiness. Never use production credentials or Mainnet endpoints for test runs. E2E flags should be enabled only with disposable test accounts, explicit target URLs and isolated test data.

### Migration source duplication is not migration-history duplication

There are no exact duplicate migration files or duplicate migration versions. Repeated object declarations across distinct migrations are often intentional evolution (`CREATE OR REPLACE`, changed constraints, policy repair, or index reconciliation). Do not delete historical declarations based on text similarity. The earlier duplicate-object CSV is a review queue, not a deletion list. Any cleanup should be forward-only and based on semantic comparison plus a disposable database diff.

### Application completeness cannot be inferred from file counts

The repository has broad feature, UI and API coverage and extensive source-level regression checks. However, source presence does not prove every user journey works against populated Testnet data. Prior project truth explicitly notes external Pi Sandbox authorization rejection and the deliberate Field Research / Research Studio isolation. These statuses should remain visible in release notes and acceptance coverage rather than being silently treated as completed.

## Release decision

**NOT APPROVED for live Testnet certification or Production based on this source-only audit.** The static source suite passes, but Node 24.15.0 dependency-backed checks, refreshed dependency remediation, clean PostgreSQL migration rehearsal, target migration-history/catalog reconciliation, Pi Sandbox authorization, and authenticated multi-account Testnet/browser acceptance remain required.

No live database was modified, no migration was applied, no ledger/payment/payout was initiated, and no GitHub push or Vercel deployment was performed.
