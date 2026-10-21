# GreenHaven Project Audit and Stabilization — 2026-10-21

**Audited baseline:** GH-CONNECT v0.63.23 Stage 7 archive  
**Stabilized source version:** 0.63.25  
**Scope:** repository integrity, local imports, literal internal links, npm script targets, release metadata, dependency-lock metadata, migration inventory, financial feature gates, authorization static checks, regression scripts, and CI/deployment configuration.

## Defects found and corrected

1. **Public Pi acquisition policy endpoint falsely failed the economy authorization regression.** The scanner recognized a generic `/policy/` route but not the explicit `/pi-acquisition-policy/` route. Added a narrow allow-list for that exact read-only endpoint and assertions that it uses the server-owned proposal provider and exposes no authenticated account flow or mutation methods. The endpoint remains read-only; checkout and GHC credit remain disabled.
2. **Migration manifest drift.** `VERIFIED_MANIFEST.txt` was stale relative to the canonical `supabase/migrations` directory. Regenerated the checklist/manifest from the canonical 107 SQL migration files.
3. **Stale generated inventory timestamps.** The inventory generator embedded fixed historical dates. Replaced those with deterministic generator/format metadata so generated inventory does not misrepresent its generation date and remains stable in CI.
4. **Release version consistency.** Bumped the package/release version to `0.63.25`, synchronized `package-lock.json`, app release metadata, implementation report, manifest, and version-sensitive regression expectations.
5. **Broken CI script reference.** Registered `test:pi-payment-durable` in `package.json`; the CI pipeline referenced it but had no matching npm script. Added a dedicated `test:reported-build-regressions` suite to `ci:verify` so the historical TypeScript/build failures and this script-wiring regression stay covered.
6. **Historical build failures re-checked.** Confirmed source-level fixes for the profile edit callback/media signature, explicit nullable image-validation callback type, and the wallet self-reference (`walletSnapshot`). Added checks for `formatIntentChip` import and string guards around media URL `startsWith` calls. These are static source regressions, not a substitute for a full TypeScript compile.

## Verification completed

- Repository integrity: **36 checks passed, 0 errors, 0 warnings**.
- Regression scripts: **138 of 138 passed** after fixes (including the new regression test).
- Reported build regressions: **7/7 targeted static checks passed**.
- `ci:verify` npm-run wiring: **84/84 referenced commands registered**.
- Dependency lock coverage/root metadata: passed.
- Official Pi SDK lock verifier: passed.
- Pi SDK lock repair workflow regression: **15/15 passed**.
- JSX safety scan: **710 files scanned, passed**.
- Production safety scan: **21/21 passed**.
- Deployment network safety: **10/10 passed**.
- Migration release-readiness static check: passed; **107** migration files inventoried.
- Migration checklist and manifest consistency: passed.
- Release hygiene: **11/11 passed**.
- Economy authorization checks: **32 passed, 0 failed** across 26 economy routes.
- Phase 1 release readiness: **10/10 passed**.
- ZIP integrity: passed on the input archive.

## Checks not completed (environment limitation)

A clean dependency install could not complete because the environment could not resolve/reach `registry.npmjs.org` (`EAI_AGAIN`); the latest retry timed out while repeatedly failing to fetch package tarballs. The partial `node_modules` created by that attempt is excluded from the deliverable. The global TypeScript compiler cannot run the project check because required type packages are absent. The available local Node runtime is `v22.16.0`, below the repository's declared supported runtime `^22.22.2 || ^24.15.0`. Consequently, the following have **not** been verified in this environment:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- full `npm run ci:verify`
- Playwright browser E2E
- live Supabase/PostgreSQL migration and RLS tests
- Pi Browser Testnet payment/reconciliation flows
- multi-instance production concurrency, monitoring, and backup restoration

These are blocked verification gates, not passing results. Run them in the supported Node 24.15.0 CI environment after network/dependency access is available.

## Migration and release safety

The canonical migration directory contains **107** SQL files: 79 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, and 25 REVIEW_REQUIRED. The inventory is source metadata only; it is not evidence of applied migrations. Fifteen migration filenames have identifiers later than the audit date and require dependency/history review. Do not bulk-apply migrations; reconcile Testnet and Mainnet histories independently.

Pi-funded GHC acquisition, business checkout, and other financially sensitive features remain gated. No database migration was applied, no balances were changed, and no deployment was performed during this audit.

## Release decision

**Static regression suite: PASS. Production release: NOT APPROVED YET.** Typecheck, lint, production build, browser E2E, and operator/runtime gates must pass before release approval.
