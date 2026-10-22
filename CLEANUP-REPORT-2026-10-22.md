# GH-CONNECT 0.69.3 — Repository Cleanup Report

## Cleanup scope

This pass focused on misleading documentation, obsolete status snapshots, and legacy test references. It intentionally did not delete application modules, product features, SQL migrations, or dependencies merely because they appeared old or unused.

### Completed

- Replaced the root README with a concise current-version overview, entry points, safety boundaries, and the known Vercel build blocker.
- Updated `docs/PROJECT_TRUTH.md`, `docs/PHASE_IMPLEMENTATION_STATUS.md`, `docs/README.md`, and `VERCEL_DEPLOY.txt` to use current source version `0.69.3` and distinguish source checks from live release approval.
- Moved root-level dated implementation/stabilization reports to `docs/archive/historical-reports-2026-10-22/` and labeled them historical/non-authoritative.
- Removed the one-off CI repair report from the shipped root, the old duplicate migration manifest, and superseded deployment/push troubleshooting notes.
- Updated the Testnet migration gate to show the current 111-file inventory and current classification totals.
- Added an explicit diagnostic-inventory mode so the migration checklist/manifest can be refreshed without hiding duplicate migration version prefixes. Normal inventory validation still fails closed.
- Updated legacy regression contracts that asserted outdated source versions, migration counts, or a dated manifest.
- Added this report and an archive README so historical reports cannot be mistaken for current release approval.

## Verification results

- Project integrity audit: **36 checks passed, 0 errors, 0 warnings**.
- JSX safety: **727 files scanned, passed**.
- Reported build regression checks: **7/7 passed**.
- Vercel build repair regression checks: **9/9 passed**.
- Project-truth check: **14/14 passed**.
- Phase 1 release readiness contract: **13/13 passed**.
- Phase 1–2 foundation contract: **18/18 passed**.
- Stabilization Phase 3 security/migration contract: **25/25 passed**.
- Phase 1–10 integration audit: **21/21 passed**.
- Massive production pass source contract: **all checks passed**.

## Remaining blockers (not hidden by cleanup)

1. The latest supplied Vercel build for `testnet` commit `a04ebff` fails TypeScript at `contexts/ghc-context.tsx:2450` because `domains.identity` is used before `domains` is declared. This documentation cleanup does not claim to fix that deployed-branch source error.
2. The canonical migration folder contains **111 SQL files**, but two version prefixes are duplicated: `202610210001` and `202610210002`. The normal migration-inventory check remains blocked. The diagnostic manifest explicitly marks this state as blocked. Do not rename migrations blindly; first reconcile migration history and review whether either migration has been applied remotely.
3. The full TypeScript/lint/Next.js production build was not run in this cleanup environment. No claim of build success or production readiness is made.
4. npm previously reported 19 vulnerabilities plus package deprecation and install-script warnings. Those require a separate dependency audit and compatibility review.

## Safety statement

No application feature code, SQL migration, `package.json`, or lockfile was intentionally deleted or downgraded in this documentation cleanup. Existing blockers are documented rather than suppressed. Production/Mainnet release remains **not approved**.
