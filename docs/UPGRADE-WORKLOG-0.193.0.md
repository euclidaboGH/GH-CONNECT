# Upgrade worklog — 0.193.0

Date: 2026-10-30
Baseline: 0.192.0

## Scope

This increment closes a CI coverage gap discovered during the system-wide regression review. The repository already contained a runtime regression suite for bounded JSON request parsing, but the primary GitHub Actions workflow did not execute it. The suite is now an explicit CI gate immediately after JSX safety.

## Runtime regression coverage

The nine cases verify: valid object parsing; declared content-length rejection before reading; enforcement against actual streamed bytes even when the declared length is smaller; malformed JSON rejection; rejection of array and scalar JSON; invalid UTF-8 rejection; invalid configured limit rejection; and bodyless request rejection.

## Verification performed locally

- `node --experimental-strip-types scripts/test-bounded-json-runtime.mjs`: 9/9 passed on Node 22.16.0.
- `node scripts/verify-phase14-static.mjs`: 57/57 passed.
- `node scripts/scan-production-safety.mjs`: 21/21 passed.
- `node scripts/check-security-headers.mjs`: 7/7 passed.
- `node scripts/check-api-csrf-contract.mjs`: 7/7 passed.
- `node scripts/check-database-contract-source.mjs`: 129 executable tables across 161 migrations.
- `node scripts/check-migration-release-readiness.mjs`: passed static migration review.

## Release limitations

This is a source-level CI improvement, not a live deployment. The environment is Node 22.16.0 while the project requires Node.js 24.15.0; dependencies are not installed. A full TypeScript, ESLint and Next.js build was not performed. PostgreSQL migration execution, concurrency tests, Supabase application, Pi Testnet payment E2E, marketplace settlement E2E and browser acceptance remain outstanding. No GitHub push, Vercel deployment or database mutation was performed.
