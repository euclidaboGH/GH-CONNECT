# Upgrade worklog — 0.338.98 / Run 316 (2026-11-17)

## Purpose

Repair the Vercel prebuild regression reported after Run 315. The Run #299 build-contract check incorrectly searched `docs/PROJECT_TRUTH.md` for only two historical release-status phrasings, while the current document correctly states `**Current status:** **NOT APPROVED** for production.

## Change

1. Reproduced the exact Run #299 release-gate assertion failure from the supplied CI output.
2. Inspected the current `docs/PROJECT_TRUTH.md` status wording rather than changing the release status.
3. Updated the Run #299 contract to recognize the canonical `Current status: NOT APPROVED` statement.
4. Retained compatibility with the two historical status phrasings.
5. Confirmed the check still requires an explicit NOT APPROVED declaration.
6. Left all production approval and operator acceptance gates intact.
7. Kept the remediation limited to the regression-test source; no runtime application behavior changed.
8. Synchronized package, lockfile and app release metadata to 0.338.98.
9. Updated current project documentation and added this Run 316 worklog and audit addendum.
10. Re-ran the focused Vercel build-contract and Maintenance 30 checks.

- Updated `scripts/check-run299-vercel-build-contract.mjs` so its release-gate assertion accepts the current `Current status:** **NOT APPROVED**` wording while retaining the historical accepted phrasings.
- No production approval language was changed. `docs/PROJECT_TRUTH.md` continues to declare the project NOT APPROVED for production.
- No application runtime, financial, wallet, payment, payout, entitlement, migration, database, provider, or service-registry behavior was changed.
- Synchronized the source release version to 0.338.98 in package/lock/app metadata and current release documentation.

## Verification

- Run #299 Vercel build-contract regression: 20/20.
- Run #298 maintenance 30: 30/30.
- Full `npm run verify:static`: PASS (exit code 0) under the available local Node 22.16.0 runtime; this is a source-only verification scope, not supported-runtime build certification.
- Node 24.15.0 dependency-backed typecheck, lint and Next.js production build remain required; this source check does not certify them.

## Operational boundary

Source-only local derivative. No GitHub push, Vercel deployment, Supabase operation, migration application, wallet/payment/payout mutation, Pi A2U execution, or Mainnet operation was performed. Production remains NOT APPROVED.
