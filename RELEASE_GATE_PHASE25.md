# Phase 25 release gate — GH-CONNECT 0.62.5

## Passed in this workspace

- `npm run audit:project-integrity`: 33 checks passed, 0 errors, 1 warning (the missing `pi-backend` lock graph).
- Project-integrity audit regression tests: 13/13 passed after the health-version fallback and signing-key ignore additions.
- All 129 `scripts/test-*.mjs` regression scripts passed in the final rerun after the health-version and Git ignore hardening edits.
- Local imports, npm script targets, literal internal navigation, release metadata, Vercel commands, security-header ownership, `.gitignore`, health endpoint version fallback, signing-key ignore rules, and generated-artifact checks pass.
- Release hygiene: 11/11; production safety scan: 21/21; deployment network safety: 10/10; provider feature-gate checks: 17/17; JSX safety: 687 files scanned; migration inventory consistency passed (105 SQL files).
- This report does not imply a clean install or production build.

## Install/build attempts

- `npm install --package-lock-only --legacy-peer-deps --ignore-scripts --no-audit --no-fund` timed out during registry access; the lockfile SHA-256 matched the pre-attempt backup.
- `npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund --offline` failed with `ENOTCACHED` for `pi-backend`.
- `npm run typecheck` failed because the dependencies and React/Node/Next declarations are not installed in this workspace.
- `npm run lint` failed to start because ESLint is not installed.
- `npm run build` passed the JSX precheck but failed to start because Next.js is not installed.

## Blocking release finding

- `package-lock.json` lacks `node_modules/pi-backend` despite `package.json` declaring `pi-backend@0.1.3`. The project uses this official SDK in the server-side Pi A2U adapters. Do not remove it merely to make npm lock checks pass. Refresh the lock graph using npm from a registry-connected environment on Node 24.15.0 (or supported Node 22.22.2+) and inspect the resulting lock diff.

## Required before a deployable release (GitHub review branches may be pushed separately)

1. On Node 24.15.0: `npm install --package-lock-only --legacy-peer-deps --no-audit --no-fund`. Review and commit the real `package-lock.json` change.
2. `npm ci --legacy-peer-deps`.
3. `npm run audit:project-integrity`.
4. `npm run typecheck`.
5. `npm run lint`.
6. `npm run ci:verify`.
7. `npm run build`.
8. Run the preview E2E suite against a dedicated Testnet preview and review uploaded screenshots/traces.
9. Separately verify Pi authentication/U2A/A2U recovery, Supabase schema/concurrency, and Paystack Test Mode reconciliation.
10. Confirm all environment variables are configured in Vercel, never committed, and financial provider features remain disabled until their own gates pass.

Do not apply Supabase migrations or enable live payouts as part of repository cleanup. No push/deploy has been performed by this change.

## Phase 26 lockfile recovery automation

- Added `.github/workflows/repair-npm-lock.yml`, a manual Node 24.15.0 workflow that regenerates `package-lock.json` from official npm metadata, validates the Pi SDK graph, performs a clean install, runs `npm run ci:verify`, and opens a lockfile-only pull request only after success.
- Added `scripts/verify-pi-backend-lock.mjs` and wired it into `ci:verify`; it fails closed until the official `pi-backend@0.1.3` tarball, integrity metadata, `axios`, and `stellar-sdk` entries exist.
- Added 15/15 workflow structural tests and extended repository-integrity regression checks to 15/15.
- All 130 `scripts/test-*.mjs` regression scripts passed locally; workflow YAML parses successfully; release hygiene 11/11 and migration inventory check passed.
- The SDK lock verifier still fails in this network-isolated workspace because `node_modules/pi-backend` is absent. This is expected until the GitHub-hosted repair workflow (or a registry-connected local Node 24.15.0 environment) generates the real lock graph. Do not mark the release deployable before that workflow completes and its PR is reviewed/merged.
