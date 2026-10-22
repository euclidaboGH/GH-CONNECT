> HISTORICAL RECORD — not current release status. Check `docs/PROJECT_TRUTH.md` and current CI evidence before relying on this report.

---

# GH-CONNECT Phase 2 — Production Readiness and Reliability Report

**Source baseline:** `GH-CONNECT-0.63.18-PHASE1-ASSET-SAFETY.zip`  
**Project version:** `0.63.18`  
**Status:** Source-level phase completed; dependency-backed and live release gates remain blocked/unverified.  
**Database/deployment actions:** No Supabase migration applied; no Vercel deployment performed; no live Pi transaction executed.

## Changes implemented

1. Reconciled `package.json` and `package-lock.json` root versions at `0.63.18`; dependency declarations were not intentionally changed.
2. Reconciled `lib/app-release.ts` with the canonical package version and current release summary.
3. Regenerated `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt` from the canonical migration directory: 106 SQL files (78 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 25 REVIEW_REQUIRED). Inventory is not evidence that migrations are applied remotely.
4. Updated the phase status document to match the current migration inventory and latest migration filename.
5. Documented all referenced environment flags in `.env.example`, including safe defaults `GHC_ACTIVITY_REWARDS_ENABLED=0` and `GHC_WITHDRAWALS_ENABLED=false`.
6. Fixed a media publication guard: all non-durable image URLs are now rejected before publishing, including small data URLs. This prevents local-only data URLs from being persisted as if they were durable shared media.
7. Completed the daily GHC reward attention notice. The notice is deduplicated per user/reward day, provides an explicit action to open rewards, supports dismissal and keeps claim eligibility server-authoritative.
8. Updated the media compression regression test to match the current helper argument and upload threshold; updated the expected user-facing direct-upload message.
9. Added/restore source documentation used by existing regression checks: global beta programme, GHC economy/fees roadmap, Pi integration engineering review, screen-by-screen QA matrix and curation implementation status. These documents explicitly distinguish engineering checks from platform/legal approval and live verification.

## Automated verification

- **132/132** `scripts/test-*.mjs` regression scripts passed after repairs.
- Project integrity audit: **36 checks passed, 0 errors, 0 warnings**.
- Release hygiene: **11/11 passed**.
- Dependency lock coverage/root version check: passed.
- Generated migration inventory consistency: passed; 106 migrations enumerated.
- JSX safety: passed; 701 files scanned.
- Production safety scan: **21 passed, 0 failed**.
- Deployment network safety: **10/10 passed**.
- Realtime transport hardening: **15/15 passed**.
- Phase 2 financial source gates: critical source/migration checks passed; the script reports **16/17 logical groups** and still requires disposable PostgreSQL application plus operator SQL smoke testing.
- Pi durable payment static suite, private media signed URL checks, IDOR static scan and GHC withdrawal default-off tests passed within the regression run.

## Blocking / unverified checks

The dependency install could not complete because the package registry was unreachable from this environment (`getaddrinfo EAI_AGAIN registry.npmjs.org`). The available Node runtime is `22.16.0`, below the repository's declared supported Node minimum `22.22.2`; the repository CI and `.nvmrc` target Node `24.15.0`.

Consequently:

- `npm ci --legacy-peer-deps` did **not** complete.
- TypeScript typecheck could not run with project dependencies; global `tsc` reported missing type definitions because the partial install was incomplete.
- ESLint and Next.js production build were **not run successfully**.
- No disposable PostgreSQL database was available for migration application/concurrency tests.
- No live Supabase RLS, Vercel Preview, Pi Browser, payment-provider, or two-account E2E tests were performed.

## Required operator gates before deployment

1. Use Node `24.15.0` and a registry-connected environment.
2. Run `npm ci --legacy-peer-deps` from a clean tree.
3. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
4. Run the repository CI suite and capture the commit/build identifiers.
5. Apply selected migrations only to a disposable PostgreSQL database and dedicated Testnet after reviewing the migration inventory and dependency order.
6. Verify Preview/Testnet Pi authentication/payment flows and two-account IDOR behavior.
7. Reconcile Testnet database migration history before any live migration. Do not apply the inventory wholesale.
8. Keep GHC-to-Pi withdrawals, Pi-funded GHC acquisition, A2U payouts and other financially gated features disabled until their independent release gates pass.

**Release decision:** Do not treat this archive as production-ready until the dependency-backed build and runtime/operator gates above are completed.
