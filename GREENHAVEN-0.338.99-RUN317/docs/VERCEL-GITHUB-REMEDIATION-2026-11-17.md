# GREENHAVEN Vercel and GitHub remediation — 2026-11-17

## Confirmed root cause

The Vercel deployment from `testnet` commit `f4ef11f` stopped at prebuild check 004/358. `scripts/check-run300-release-integrity.mjs` synchronously read `.github/workflows/ci.yml`, but GitHub's Contents API returned 404 for that path on the `testnet` branch. The same file exists on the repository's default branch. The supplied source archive omitted `.github/workflows/ci.yml` and `.gitignore`.

## Changes in this candidate

- Restored the existing default-branch `.github/workflows/ci.yml` into the candidate, preserving its read-only permissions, Node 24.15.0 pin, lockfile check before `npm ci`, static/RLS/SECURITY DEFINER checks, typecheck, lint, safety scan and production build.
- Added a conservative `.gitignore` because neither the Testnet nor default branch returned an existing root `.gitignore`.
- Hardened Run #300 so absent workflow metadata yields clear check failures instead of an uncaught `ENOENT` stack trace.
- Corrected the malformed case-insensitive regex checks for `NOT APPROVED`.
- Updated current release pointers in the audit register, acceptance fixture and Phase 12 readiness fixture while retaining dated historical snapshots.

## Dependency warning disposition

The Vercel log reports 22 vulnerabilities (1 low, 6 moderate, 13 high, 2 critical) and deprecated `isomorphic-dompurify@3.20.0`, `js-xdr@1.3.0`, `stellar-base@8.2.2`, `stellar-sdk@10.4.1`, and `eslint@9.39.5`.

The current environment cannot reach the npm registry (`EAI_AGAIN`/timeout), so a current audit report and reproducible lockfile regeneration are unavailable. `isomorphic-dompurify@4.x` is the upstream semver-correct major line and requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`; the project runtime satisfies that requirement. Next.js 15.5.29 is the published 15.x security-patched release identified by the November 2026 advisory summaries. ESLint 9 is EOL and ESLint 10 is current, but its migration has breaking behavior and requires a clean install/test. These package upgrades are not applied here because the lockfile cannot be regenerated and tested without registry access.

The three deprecated Stellar packages are transitive dependencies of `pi-backend@0.1.3` and sit on Pi payment/signing paths. Replacing them with `@stellar/*` packages via npm overrides would be unsafe without a compatible Pi adapter and Testnet transaction/XDR acceptance. No blind override was applied.

## Verification performed

- `node scripts/check-run300-release-integrity.mjs` — run after changes; results recorded in the delivery summary.
- `node scripts/check-run301-release-gate-hardening.mjs` — run after changes; results recorded in the delivery summary.
- `node scripts/check-phase1-10-upgrade-pack.mjs` — run after changes; results recorded in the delivery summary.
- Full Node 24.15.0 clean install, 358-check prebuild, TypeScript, lint, production build and browser/device tests remain unverified in this environment.

## Operational boundaries

No GitHub commit/push, Vercel deployment, Supabase migration, financial mutation, scanner activation, or Mainnet operation was performed. Production remains NOT APPROVED.
