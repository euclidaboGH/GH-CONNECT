# Phase 10 — related release blockers and verification status

Date: 2026-11-02
Source version: `gh-connect@0.274.3`

## Implemented and rechecked

- Repaired the CI-177 source-contract drift for registration bonus placement and nullable economy database values.
- Changed message composition so a draft is cleared only after the send/reply operation returns an accepted result; failed or ambiguous sends retain the draft and do not remove its local recovery copy.
- Added/updated the CI-177 regression assertions and repair notes.
- Confirmed dependency-lock coverage and the official `pi-backend` package lock metadata.
- Re-ran the comprehensive static suite and discovery-based production source verifier.
- Re-ran release hygiene, production safety, security-header, API-CSRF, RLS source-coverage, and `SECURITY DEFINER` source checks.

## Verification results in this environment

- `npm run verify:static`: PASS (exit 0).
- `npm run verify:production`: PASS, 242 passed / 0 failed.
- `npm run check:dependency-lock-integrity`: PASS.
- `npm run check:pi-backend-lock`: PASS.
- `npm run check:release-hygiene`: PASS, 11/11.
- `npm run test:safety`: PASS, 21/21.
- `npm run check:security-headers`: PASS, 7/7.
- `npm run check:api-csrf`: PASS, 7/7.
- `npm run check:database-rls-coverage`: PASS for static source coverage only.
- `npm run check:security-definer-acl`: PASS for static source patterns only.

## Remaining release blockers (not safely resolvable in this environment)

This environment has Node.js `v22.16.0`; the project pins `.nvmrc` to `24.15.0` and declares `engines.node` as `^24.15.0`. Network DNS resolution is unavailable here, so a supported Node runtime and locked npm dependencies cannot be downloaded. Therefore `npm ci`, TypeScript, ESLint, and the Next.js production build have not been successfully verified in this pass. Do not treat source-contract success as a successful production build.

Live deployment and operator verification also require access to the target GitHub/Vercel/Supabase/Pi test environments and their approved credentials. No remote push, deployment, live migration, or financial operation was performed. Do not apply migrations or enable payment/withdrawal paths based solely on this report.

## Required final release sequence

1. Use Node.js `24.15.0` (or a compatible Node 24 release satisfying `^24.15.0`).
2. Run `npm ci --legacy-peer-deps --no-audit` from a clean checkout.
3. Run `npm run typecheck`, `npm run lint`, `npm run verify:static`, `npm run verify:production`, and `npm run build`.
4. Push this reviewed source to the intended branch and inspect the resulting GitHub Actions run.
5. Perform the approved Pi Browser/Testnet, Supabase persistence, and payment-recovery smoke tests. Keep production financial controls fail-closed until operator evidence passes.
