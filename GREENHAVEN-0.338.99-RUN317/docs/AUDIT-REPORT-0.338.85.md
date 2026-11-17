# GreenHaven 0.338.85 — source audit and repair report

Date: 2026-11-15
Authoritative input: `GREENHAVEN-0.338.85-CI-NODE-ASSERT-HYGIENE.zip`
Package identity retained: `gh-connect@0.338.85`
Audit type: source, documentation, static-contract, migration-inventory and CI workflow review

## Executive result

The uploaded archive was readable and passed ZIP CRC integrity validation. The source tree contains 2,970 archive entries and 223 canonical SQL migration files. The audit repaired stale release metadata, a missing repository ignore policy, CI gate coverage and diagnostics, and a stale visual regression assertion. The complete network/database-independent static suite now passes **4,640 assertions with zero failures**. The production safety scan passes **21/21**. Production remains **NOT APPROVED**.

## Findings repaired

1. Run #301 initially reproduced six release metadata/worklog failures. Updated the Phase 1–12 acceptance fixture, Phase 12 release-readiness fixture, current worklog, README, project-truth and current bundle/build-context metadata to the uploaded 0.338.85 baseline.
2. `LATEST-PROJECT-BUNDLE-README.md` still described 0.338.73 as current. Replaced the stale pointer with the uploaded 0.338.85 archive identity, migration inventory and release blockers.
3. The archive omitted `.gitignore`, although the wallet-ledger resilience gate and cache policy require one. Added ignore rules for dependency/build/cache/test output, incremental TypeScript state, local secrets (while retaining `.env.example`), logs, archives and editor/OS noise.
4. Phase 17 found CI did not explicitly register several critical request, payment, marketplace, treasury and RPC contracts. Added a dedicated workflow step for bounded JSON runtime tests, request-boundary follow-up, marketplace integrity, wallet reconciliation, treasury completion, payment recovery/timeline, marketplace payment binding and RPC transport.
5. Added CI concurrency cancellation for superseded runs on the same workflow/ref, npm version reporting, removal of stale user-level npm `cache-dir` configuration, and failure-gated upload of `.next/trace` and `.next/diagnostics`.
6. Added an explicit CI duplicate-JSX-prop safety step.
7. Updated a stale Phase 2 visual-cohesion regression assertion from `gap-y-2` to the actual current shared post-action layout `gap-y-1.5`; no UI implementation was changed by this test correction.
8. Corrected project/source/build documentation to identify the 0.338.85 authority and retain explicit runtime, migration and production acceptance limits.

## Verification evidence

| Gate | Result |
|---|---:|
| `npm run verify:static` | **4,640 assertions; 0 failures** |
| `npm run test:safety` | **21/21 PASS** |
| Run #301 release-gate hardening | **20/20 PASS** |
| Phase 12 final release readiness | **28/28 PASS** |
| Phase 17 CI governance | **16/16 PASS** |
| Phase 24 release review | **PASS** |
| Release hygiene | **17/17 PASS** |
| Migration source manifest | **223/223 PASS** |
| SQL lexical integrity | **223 migrations PASS** |
| Project-truth consistency | **11/11 PASS** |
| Wallet ledger resilience | **17/17 PASS** |
| Phase 28 wallet consent flow | **46/46 PASS** |
| Run 247 build diagnostics | **15/15 PASS** |
| Run 249 wallet recovery/build guards | **24/24 PASS** |
| Prebuild inventory | **348 checks discovered; dry-run listing PASS** |

## Migration and financial safety

The source manifest classifies 223 migrations as:
- 119 REQUIRED
- 1 REQUIRES_APPROVAL
- 2 PROPOSAL
- 101 REVIEW_REQUIRED

These are source classifications, not proof of remote application. No migration was applied, renamed, deleted or reclassified. Do not run `supabase db push` or replay pending migrations until Testnet and Mainnet migration histories have been reconciled independently and held migrations have passed the required disposable-PostgreSQL/Testnet review.

Pi and GHC remain separate payment rails. No wallet balance, ledger, withdrawal reservation, payment intent, provider transfer or payout execution state was changed. No external database, Pi provider, GitHub repository or Vercel deployment was contacted or mutated.

## Remaining release blockers

The audit environment is Node.js 22.16.0 and has no installed `node_modules`; the project requires Node.js 24.15.0. Therefore this audit does **not** claim:
- clean `npm ci --legacy-peer-deps` under Node 24.15.0;
- dependency-backed TypeScript typecheck, ESLint or Next.js production build;
- full execution of all 348 prebuild checks under Node 24.15.0;
- Playwright/browser/device, Android/Pi Browser, two-account IDOR or cross-device acceptance;
- live database/RPC, Testnet migration-history, Pi provider, concurrency or operator acceptance;
- fresh Vercel Preview build/smoke acceptance.

No GitHub push, pull request, Vercel deployment or production approval was performed.

**Final status: source/static audit PASS; runtime and operator acceptance OPEN; production NOT APPROVED.**
