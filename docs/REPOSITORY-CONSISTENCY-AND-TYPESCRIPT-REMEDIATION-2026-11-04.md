# Repository consistency and TypeScript remediation — 2026-11-04

## Authority and scope

This review starts from the complete `0.312.0` repository archive and follows `docs/SOURCE_OF_TRUTH.md` and `docs/CURRENT_BUILD_CONTEXT.md`. It does not import code or assumptions from older archives. No database migration, financial authority, provider contract, authentication boundary, or product feature was changed.

## Corrections and preventive coverage

- Added `scripts/check-repository-consistency.mjs` and registered it in `prebuild`, `verify:static`, and the `check:repository-consistency` npm script.
- The new gate checks `package.json` against the package-lock root identity and Node engine, verifies `.nvmrc` matches the minimum version in the declared Node engine, confirms ESM mode, resolves relative and `@/` imports across the repository's TS/JS source files, and verifies every directly referenced npm `.mjs` script target exists.
- Kept the existing strict TypeScript configuration (`strict: true`, `noEmit: true`, `skipLibCheck: true`). No compiler option was weakened and no blanket `any` conversion was introduced.
- Existing `scripts/check-build-type-regressions.mjs` continues to validate wallet numeric-field mapping, normalized Pi transaction projections, payment metadata narrowing, donation amount validation, governance report narrowing, and CI Node/action pinning.
- Existing migration manifest and migration integrity gates remain authoritative for duplicate migration prefixes, missing migration files, and manifest drift.

## Findings from this archive

- Package and lockfile both identify `gh-connect` version `0.312.0`.
- Package and lockfile Node engine declarations both equal `^24.15.0`; `.nvmrc` is `24.15.0`.
- ESM package mode is enabled.
- 1,243 TS/JS source files were scanned; no unresolved relative or `@/` imports were found.
- No directly referenced npm script target was missing.
- The canonical migration gates report 177 migrations, no duplicate numeric prefixes, and a synchronized source manifest.
- `scripts/check-build-type-regressions.mjs` passes 7/7.

## Runtime and dependency warning disposition

The inspection container only provides Node `v22.16.0`, while this repository explicitly requires `^24.15.0`. A dependency installation attempt could not complete because the package registry was unreachable from this environment; `node_modules` was therefore not treated as a valid installed dependency tree. Consequently, the actual TypeScript compiler, ESLint, and Next.js build could not be run here.

The engine warnings observed under Node 22 for `isomorphic-dompurify`, `jsdom`, and `undici` are not treated as evidence of a Node 24 incompatibility: their declared supported ranges include Node 24.15.0. The previously supplied Vercel log's deprecation/advisory findings for Stellar packages, ESLint support, npm `cache-dir`, and native install scripts remain subject to the documented review:

- Obtain the complete `npm audit --json` output under Node 24.15+ before selecting patched versions.
- Review the `pi-backend` Stellar SDK import/API contract before any SDK migration.
- Coordinate any ESLint/Next.js configuration migration; do not perform an isolated major upgrade.
- Check Vercel environment variables for the obsolete `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir`; the repository `.npmrc` does not define `cache-dir`.
- Approve only the native install scripts proven necessary by dependency provenance and runtime tests.
- Do not run `npm audit fix --force` or blanket-allow install scripts.

## Verification evidence

- `node scripts/check-build-type-regressions.mjs`: PASS, 7/7.
- `node scripts/check-repository-consistency.mjs`: PASS, 6/6; 1,243 files scanned, zero unresolved local imports, zero missing script targets.
- `npm run verify:static`: PASS, 57/57 consolidated top-level contracts, with the repository consistency gate also registered in the static command.
- `node scripts/verify-production-release.mjs`: source verification PASS, 248/248 before this new check was added; the follow-up run must include the new gate.

## Explicitly not certified

A clean TypeScript compilation, lint run, production build, browser E2E, live provider/database verification, or production approval is **not** claimed. These require a supported Node `24.15.0` or newer runtime and a completed locked dependency installation. Source-level import resolution is a useful consistency guard, not a substitute for `tsc`.
